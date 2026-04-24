"use client";

import { useMemo, useRef, useState } from "react";
import { RefreshCcw, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { trackConcurrentTask, waitForAvailableSlot } from "@/utils/concurrency";
import {
  beginWorkspaceReprocess,
  finishWorkspaceReprocess,
  markWorkspacePhotoReprocessFailed,
  reprocessWorkspacePhoto,
  type WorkspaceProcessMode,
} from "@/actions/reprocess";
import { ensureFaceModels, filterReliableDetections, getFullFaceDescription } from "@/utils/faceApi";

interface ReprocessPhoto {
  id: string;
  url: string;
  analysisStatus: "QUEUED" | "PROCESSED" | "NO_FACE" | "FAILED";
}

interface ReprocessWorkspaceButtonProps {
  workspaceId: string;
  workspaceName: string;
  photos: ReprocessPhoto[];
}

type ReprocessStats = {
  total: number;
  processed: number;
  faces: number;
  failed: number;
};

const DESKTOP_REPROCESS_CONCURRENCY = 2;
const MOBILE_REPROCESS_CONCURRENCY = 1;

function isLikelyMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

function buildEmptyStats(total: number): ReprocessStats {
  return {
    total,
    processed: 0,
    faces: 0,
    failed: 0,
  };
}

export default function ReprocessWorkspaceButton({
  workspaceId,
  workspaceName,
  photos,
}: ReprocessWorkspaceButtonProps) {
  const router = useRouter();
  const stopRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("Ready to process uploads");
  const [stats, setStats] = useState<ReprocessStats>(buildEmptyStats(photos.length));

  const pendingPhotos = useMemo(
    () => photos.filter((photo) => photo.analysisStatus === "QUEUED" || photo.analysisStatus === "FAILED"),
    [photos],
  );
  const hasPendingPhotos = pendingPhotos.length > 0;
  const defaultMode: WorkspaceProcessMode = hasPendingPhotos ? "queued" : "full";
  const targetPhotos = defaultMode === "queued" ? pendingPhotos : photos;

  const updateStats = (patch: Partial<ReprocessStats>) => {
    setStats((current) => ({ ...current, ...patch }));
  };

  const handleReprocess = async () => {
    if (targetPhotos.length === 0) {
      setStatus("Add photos first, then process the workspace.");
      return;
    }

    if (!confirming) {
      setConfirming(true);
      return;
    }

    const mobileMode = isLikelyMobileDevice();
    const laneCount = mobileMode ? MOBILE_REPROCESS_CONCURRENCY : DESKTOP_REPROCESS_CONCURRENCY;
    const analysisMaxDimension = mobileMode ? 1280 : 1600;

    setConfirming(false);
    stopRef.current = false;
    setRunning(true);
    setStats(buildEmptyStats(targetPhotos.length));
    setStatus("Loading face engine...");

    try {
      await ensureFaceModels();
    } catch (error) {
      console.error("Failed to load face engine for processing", error);
      setRunning(false);
      setStatus("Face engine could not start on this device.");
      return;
    }

    setStatus(defaultMode === "queued" ? "Preparing queued uploads..." : "Clearing old face index...");

    const startResult = await beginWorkspaceReprocess(workspaceId, defaultMode);
    if (!startResult.success) {
      setRunning(false);
      setStatus(startResult.error ?? "Could not start processing.");
      return;
    }

    if ((startResult.photoCount ?? 0) === 0) {
      setRunning(false);
      setStatus(defaultMode === "queued" ? "No queued uploads to process." : "No photos found to rebuild.");
      router.refresh();
      return;
    }

    let processed = 0;
    let faces = 0;
    let failed = 0;
    const pendingReprocess = new Set<Promise<unknown>>();

    setStatus(
      defaultMode === "queued"
        ? `Processing queued uploads with ${laneCount} safe lane${laneCount === 1 ? "" : "s"}...`
        : `Rebuilding the full workspace with ${laneCount} safe lane${laneCount === 1 ? "" : "s"}...`,
    );

    for (const photo of targetPhotos) {
      if (stopRef.current) {
        break;
      }

      try {
        setStatus(`Scanning ${processed + 1}/${targetPhotos.length}`);
        const { image, detections } = await getFullFaceDescription(photo.url, {
          maxDimension: analysisMaxDimension,
        });
        const reliableDetections = filterReliableDetections(detections, {
          imageWidth: image.width,
          imageHeight: image.height,
          minScore: mobileMode ? 0.62 : 0.66,
          minAbsoluteFaceSize: mobileMode ? 36 : 42,
          minRelativeFaceSize: mobileMode ? 0.032 : 0.04,
        });
        const descriptors = reliableDetections.map((detection) => Array.from(detection.descriptor));

        await waitForAvailableSlot(pendingReprocess, laneCount);
        trackConcurrentTask(
          pendingReprocess,
          (async () => {
            const result = await reprocessWorkspacePhoto({
              workspaceId,
              photoId: photo.id,
              descriptors,
            });

            if (!result.success) {
              throw new Error(result.error ?? "Processing failed");
            }

            processed += 1;
            faces += result.detectedFaces ?? descriptors.length;
            updateStats({ processed, faces, failed });
          })().catch(async (error) => {
            console.error("Workspace photo reprocess failed:", error);
            await markWorkspacePhotoReprocessFailed(workspaceId, photo.id);
            processed += 1;
            failed += 1;
            updateStats({ processed, faces, failed });
          }),
        );

        if (mobileMode) {
          await new Promise((resolve) => window.setTimeout(resolve, 16));
        }
      } catch (error) {
        console.error("Workspace photo reprocess failed:", error);
        await markWorkspacePhotoReprocessFailed(workspaceId, photo.id);
        processed += 1;
        failed += 1;
        updateStats({ processed, faces, failed });
      }
    }

    await Promise.all(Array.from(pendingReprocess));
    await finishWorkspaceReprocess(workspaceId);
    setRunning(false);
    setStatus(stopRef.current ? "Processing paused" : defaultMode === "queued" ? "Queued uploads processed" : "Workspace rebuild complete");
    router.refresh();
  };

  return (
    <div className="surface-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow-badge">
            <ShieldCheck className="h-3.5 w-3.5" />
            Processing
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-950">
            {hasPendingPhotos ? "Process uploaded photos" : "Rebuild workspace index"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {hasPendingPhotos
              ? "Run face indexing for the queued originals."
              : "No queued items left. Rebuild the full workspace when you upgrade the model."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {confirming && !running && (
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleReprocess()}
            disabled={running || targetPhotos.length === 0}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              confirming && !running
                ? "border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                : "bg-slate-950 text-white hover:bg-slate-800"
            }`}
          >
            {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {running
              ? "Processing"
              : confirming
                ? defaultMode === "queued"
                  ? "Confirm process"
                  : "Confirm rebuild"
                : hasPendingPhotos
                  ? "Process images"
                  : "Reprocess images"}
          </button>
        </div>
      </div>

      {confirming && !running && (
        <div className="mt-4 rounded-[1.3rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {defaultMode === "queued"
            ? `Index ${targetPhotos.length} queued photo${targetPhotos.length === 1 ? "" : "s"} in ${workspaceName}.`
            : `Rebuild all ${targetPhotos.length} photo${targetPhotos.length === 1 ? "" : "s"} in ${workspaceName} with the current model.`}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="surface-card-muted p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Pending</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{pendingPhotos.length}</div>
        </div>
        <div className="surface-card-muted p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Done</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {stats.processed}/{stats.total}
          </div>
        </div>
        <div className="surface-card-muted p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Faces</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.faces}</div>
        </div>
        <div className="surface-card-muted p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Failed</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.failed}</div>
        </div>
      </div>

      {running && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{status}</span>
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
                setStatus("Stopping after active image...");
              }}
              className="font-medium text-red-700 transition hover:text-red-800"
            >
              Stop
            </button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-950 transition-all duration-300"
              style={{
                width:
                  stats.total === 0
                    ? "0%"
                    : `${Math.min((stats.processed / stats.total) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {!running && <div className="mt-4 text-sm text-slate-500">{status}</div>}
    </div>
  );
}
