"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HardDriveUpload,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadPhoto } from "@/actions/upload";
import { trackConcurrentTask, waitForAvailableSlot } from "@/utils/concurrency";
import {
  clearCompletedUploadQueue,
  enqueueUploadFiles,
  listUploadQueueItems,
  markInterruptedUploadsAsQueued,
  updateUploadQueueItem,
  type UploadQueueItem,
} from "@/utils/uploadQueue";

interface UploadFormProps {
  workspaceId: string;
  workspaceName: string;
}

interface UploadRunProgress {
  total: number;
  processed: number;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DESKTOP_UPLOAD_CONCURRENCY = 2;
const MOBILE_UPLOAD_CONCURRENCY = 1;

function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

export default function UploadForm({ workspaceId, workspaceName }: UploadFormProps) {
  const router = useRouter();
  const stopRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [queueReady, setQueueReady] = useState(false);
  const [status, setStatus] = useState("Loading upload queue...");
  const [logs, setLogs] = useState<string[]>([]);
  const [runProgress, setRunProgress] = useState<UploadRunProgress>({
    total: 0,
    processed: 0,
  });

  const refreshQueue = async () => {
    const items = await listUploadQueueItems(workspaceId);
    setQueueItems(items);
    return items;
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateQueue = async () => {
      try {
        await markInterruptedUploadsAsQueued(workspaceId);
        const items = await listUploadQueueItems(workspaceId);

        if (!cancelled) {
          setQueueItems(items);
          setQueueReady(true);
          setStatus(
            items.some((item) => item.status === "queued" || item.status === "error")
              ? "Queued uploads ready to resume"
              : "Upload queue ready",
          );
        }
      } catch (error) {
        console.error("Failed to restore upload queue", error);
        if (!cancelled) {
          setQueueReady(true);
          setStatus("Upload queue unavailable on this device");
          setLogs(["Upload queue could not be restored on this browser."]);
        }
      }
    };

    void hydrateQueue();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const addLog = (message: string) => {
    setStatus(message);
    setLogs((current) => [message, ...current].slice(0, 8));
  };

  const queueStats = useMemo(() => {
    return queueItems.reduce(
      (summary, item) => {
        if (item.status === "queued") {
          summary.queued += 1;
        } else if (item.status === "uploading") {
          summary.uploading += 1;
        } else if (item.status === "uploaded" || item.status === "skipped") {
          summary.uploaded += 1;
        } else if (item.status === "error") {
          summary.failed += 1;
        }

        return summary;
      },
      { queued: 0, uploading: 0, uploaded: 0, failed: 0 },
    );
  }, [queueItems]);

  const resumableItems = useMemo(
    () => queueItems.filter((item) => item.status === "queued" || item.status === "error"),
    [queueItems],
  );
  const canResume = queueReady && resumableItems.length > 0 && !isUploading;
  const canClearCompleted =
    queueReady &&
    queueItems.some((item) => item.status === "uploaded" || item.status === "skipped") &&
    !isUploading;

  const setQueueItemState = async (id: string, patch: Partial<UploadQueueItem>) => {
    const nextItem = await updateUploadQueueItem(id, patch);
    if (!nextItem) {
      return null;
    }

    setQueueItems((current) =>
      current.map((item) => (item.id === id ? nextItem : item)),
    );
    return nextItem;
  };

  const runUploadQueue = async (initialItems?: UploadQueueItem[]) => {
    const sourceItems = initialItems ?? (await refreshQueue());
    const uploadableItems = sourceItems.filter(
      (item) => item.status === "queued" || item.status === "error",
    );

    if (uploadableItems.length === 0) {
      setRunProgress({ total: 0, processed: 0 });
      setStatus("No queued uploads. Choose photos first.");
      return;
    }

    const laneCount = isLikelyMobileDevice()
      ? MOBILE_UPLOAD_CONCURRENCY
      : DESKTOP_UPLOAD_CONCURRENCY;
    const pendingUploads = new Set<Promise<unknown>>();
    let successfulUploads = false;

    stopRef.current = false;
    setIsUploading(true);
    setRunProgress({
      total: uploadableItems.length,
      processed: 0,
    });
    setLogs([]);
    addLog(
      `Uploading ${uploadableItems.length} photo${uploadableItems.length === 1 ? "" : "s"} to ${workspaceName}.`,
    );
    addLog(`Originals upload first. Face indexing runs later from Process images.`);
    addLog(`Upload lanes: ${laneCount}.`);

    let processedCount = 0;

    for (const item of uploadableItems) {
      if (stopRef.current) {
        break;
      }

      if (!item.file) {
        processedCount += 1;
        setRunProgress({
          total: uploadableItems.length,
          processed: processedCount,
        });
        await setQueueItemState(item.id, {
          status: "error",
          error: "Original file is missing. Re-add this photo to upload it again.",
        });
        addLog(`${item.name} needs to be re-selected before uploading.`);
        continue;
      }

      const file = item.file;

      await waitForAvailableSlot(pendingUploads, laneCount);
      trackConcurrentTask(
        pendingUploads,
        (async () => {
          await setQueueItemState(item.id, {
            status: "uploading",
            error: null,
          });

          const formData = new FormData();
          formData.append("file", file);
          formData.append("workspaceId", workspaceId);

          const result = await uploadPhoto(formData);
          if (!result.success) {
            throw new Error(result.error || "Upload failed");
          }

          successfulUploads = successfulUploads || !result.skipped;
          await setQueueItemState(item.id, {
            status: result.skipped ? "skipped" : "uploaded",
            error: null,
            file: null,
          });

          processedCount += 1;
          setRunProgress({
            total: uploadableItems.length,
            processed: processedCount,
          });

          if (result.skipped) {
            addLog(`${item.name} already exists in this workspace.`);
          } else {
            addLog(`${item.name} uploaded. Press Process images when the batch is ready.`);
          }
        })().catch(async (error) => {
          console.error(`Upload failed for ${item.name}:`, error);
          await setQueueItemState(item.id, {
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed",
          });

          processedCount += 1;
          setRunProgress({
            total: uploadableItems.length,
            processed: processedCount,
          });
          addLog(
            error instanceof Error
              ? `Failed on ${item.name}: ${error.message}`
              : `Failed on ${item.name}.`,
          );
        }),
      );
    }

    await Promise.all(Array.from(pendingUploads));
    setIsUploading(false);

    const latestItems = await refreshQueue();
    addLog(stopRef.current ? "Upload paused. Resume whenever ready." : "Upload batch completed.");

    if (successfulUploads) {
      router.refresh();
    }

    if (!stopRef.current && latestItems.some((item) => item.status === "queued" || item.status === "error")) {
      setStatus("Some uploads still need attention. Resume the queue when ready.");
    }
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const validFiles = files.filter((file) => file.size <= MAX_UPLOAD_BYTES);
    const oversizedFiles = files.filter((file) => file.size > MAX_UPLOAD_BYTES);

    oversizedFiles.forEach((file) => {
      addLog(`Skipped ${file.name}. Keep uploads below 25 MB.`);
    });

    if (validFiles.length === 0) {
      return;
    }

    try {
      const enqueueResult = await enqueueUploadFiles(workspaceId, validFiles);
      const items = await refreshQueue();

      if (enqueueResult.duplicateCount > 0) {
        addLog(
          `${enqueueResult.duplicateCount} selected photo${enqueueResult.duplicateCount === 1 ? "" : "s"} already exist in the local upload queue.`,
        );
      }

      if (enqueueResult.addedItems.length === 0) {
        setStatus("All selected photos are already queued.");
        return;
      }

      addLog(
        `Queued ${enqueueResult.addedItems.length} photo${enqueueResult.addedItems.length === 1 ? "" : "s"} for upload.`,
      );
      await runUploadQueue(items);
    } catch (error) {
      console.error("Failed to queue uploads", error);
      addLog("Could not queue these uploads on this browser.");
    }
  };

  const progressPercent =
    runProgress.total === 0 ? 0 : Math.min((runProgress.processed / runProgress.total) * 100, 100);

  return (
    <div className="surface-card space-y-5 p-6 text-slate-950">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="eyebrow-badge">
            <HardDriveUpload className="h-3.5 w-3.5" />
            Original upload queue
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Upload to {workspaceName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Upload originals first. When the batch is done, press Process images to index faces.
            </p>
          </div>
        </div>

        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-500">
          {queueReady ? "Queue ready" : "Loading"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Queued", value: queueStats.queued + queueStats.uploading },
          { label: "Uploaded", value: queueStats.uploaded },
          { label: "Failed", value: queueStats.failed },
        ].map((item) => (
          <div key={item.label} className="surface-card-muted p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      {(runProgress.total > 0 || logs.length > 0) && (
        <div className="surface-card-muted space-y-3 p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{status}</span>
            <span>
              {runProgress.processed}/{runProgress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-950 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div>Queued: {queueStats.queued}</div>
            <div>Uploading: {queueStats.uploading}</div>
            <div>Failed: {queueStats.failed}</div>
          </div>
          <div className="space-y-2 rounded-[1.2rem] border border-slate-200 bg-white p-3 font-mono text-xs text-slate-500">
            {logs.length > 0 ? logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <div>No upload activity yet.</div>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <label
          className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[1.35rem] bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 ${
            isUploading || !queueReady ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {isUploading ? "Uploading..." : "Choose Photos"}
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFiles}
            disabled={isUploading || !queueReady}
          />
        </label>

        {canResume && (
          <button
            type="button"
            onClick={() => void runUploadQueue()}
            className="inline-flex items-center justify-center gap-2 rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            <RotateCcw className="h-4 w-4" />
            Resume upload
          </button>
        )}

        {isUploading && (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true;
              addLog("Stop requested. Finishing active uploads.");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-[1.35rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            <AlertCircle className="h-4 w-4" />
            Stop
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2">
          {queueReady ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          {status}
        </div>

        {canClearCompleted && (
          <button
            type="button"
            onClick={async () => {
              await clearCompletedUploadQueue(workspaceId);
              await refreshQueue();
              addLog("Completed uploads cleared from this device.");
            }}
            className="underline underline-offset-4 transition hover:text-slate-950"
          >
            Clear completed
          </button>
        )}
      </div>
    </div>
  );
}
