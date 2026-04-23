"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ScanSearch, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { uploadPhoto } from "@/actions/upload";
import { resizeImage } from "@/utils/image";
import {
  ensureFaceModels,
  filterReliableDetections,
  getFullFaceDescription,
} from "@/utils/faceApi";

interface UploadFormProps {
  workspaceId: string;
  workspaceName: string;
}

interface UploadStats {
  total: number;
  processed: number;
  uploaded: number;
  skipped: number;
  errors: number;
  noFace: number;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

function buildEmptyStats(total = 0): UploadStats {
  return {
    total,
    processed: 0,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    noFace: 0,
  };
}

export default function UploadForm({ workspaceId, workspaceName }: UploadFormProps) {
  const router = useRouter();
  const stopRef = useRef(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modelStatus, setModelStatus] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState("Loading face engine...");
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<UploadStats>(() => buildEmptyStats());

  const historyKey = useMemo(() => `aura_upload_history_v2:${workspaceId}`, [workspaceId]);
  const statusTone =
    modelStatus === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : modelStatus === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-500";

  useEffect(() => {
    let cancelled = false;

    ensureFaceModels()
      .then(() => {
        if (!cancelled) {
          setModelStatus("ready");
          setStatus("Face engine ready");
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setModelStatus("error");
          setStatus("Face engine failed to load");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addLog = (message: string) => {
    setStatus(message);
    setLogs((current) => [message, ...current].slice(0, 6));
  };

  const readHistory = () => {
    try {
      const item = localStorage.getItem(historyKey);
      return item ? new Set<string>(JSON.parse(item)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  };

  const writeHistory = (history: Set<string>) => {
    localStorage.setItem(historyKey, JSON.stringify(Array.from(history)));
  };

  const fileFingerprint = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

  const processFiles = async (selectedFiles: File[]) => {
    const history = readHistory();
    stopRef.current = false;
    setIsUploading(true);
    setStats(buildEmptyStats(selectedFiles.length));
    setLogs([]);
    addLog(
      `Starting upload for ${selectedFiles.length} photo${selectedFiles.length === 1 ? "" : "s"} in ${workspaceName}.`,
    );

    let hasSuccessfulUpload = false;

    for (const file of selectedFiles) {
      if (stopRef.current) {
        break;
      }

      const fingerprint = fileFingerprint(file);
      if (history.has(fingerprint)) {
        setStats((current) => ({
          ...current,
          processed: current.processed + 1,
          skipped: current.skipped + 1,
        }));
        addLog(`Skipped ${file.name}. Already in this queue.`);
        continue;
      }

      try {
        addLog(`Analyzing ${file.name}...`);
        const resizedBlob = await resizeImage(file, 1280);
        const { image, detections } = await getFullFaceDescription(resizedBlob);
        const reliableDetections = filterReliableDetections(detections, {
          imageWidth: image.width,
          imageHeight: image.height,
          minScore: 0.66,
          minAbsoluteFaceSize: 42,
          minRelativeFaceSize: 0.04,
        });
        const descriptors = reliableDetections.map((detection) => Array.from(detection.descriptor));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspaceId", workspaceId);
        formData.append("descriptors", JSON.stringify(descriptors));

        const result = await uploadPhoto(formData);
        if (!result.success) {
          throw new Error(result.error || "Upload failed");
        }

        history.add(fingerprint);
        writeHistory(history);
        hasSuccessfulUpload = hasSuccessfulUpload || !result.skipped;

        setStats((current) => ({
          ...current,
          processed: current.processed + 1,
          uploaded: current.uploaded + (result.skipped ? 0 : 1),
          skipped: current.skipped + (result.skipped ? 1 : 0),
          noFace: current.noFace + (result.analysisStatus === "NO_FACE" ? 1 : 0),
        }));

        if (result.skipped) {
          addLog(`${file.name} already exists. Skipping duplicate.`);
        } else if (result.analysisStatus === "FAILED") {
          addLog(`${file.name} uploaded, but face indexing needs attention.`);
        } else if (result.analysisStatus === "NO_FACE") {
          addLog(`${file.name} uploaded in original quality. No clear face found.`);
        } else {
          addLog(`${file.name} uploaded with ${result.detectedFaces ?? descriptors.length} face match${(result.detectedFaces ?? descriptors.length) === 1 ? "" : "es"}.`);
        }
      } catch (error) {
        console.error(`Upload pipeline failed for ${file.name}:`, error);
        setStats((current) => ({
          ...current,
          processed: current.processed + 1,
          errors: current.errors + 1,
        }));
        addLog(
          error instanceof Error
            ? `Failed on ${file.name}: ${error.message}`
            : `Failed on ${file.name}.`,
        );
      }
    }

    setIsUploading(false);
    addLog(stopRef.current ? "Upload paused." : "Upload batch completed.");

    if (hasSuccessfulUpload) {
      router.refresh();
    }
  };

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (modelStatus !== "ready") {
      alert("Face engine is still loading.");
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (oversizedFile) {
      addLog(`Skipped ${oversizedFile.name}. Keep uploads below 25 MB.`);
      return;
    }

    await processFiles(files);
  };

  return (
    <div className="space-y-5 rounded-[1.9rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            <ScanSearch className="h-3.5 w-3.5" />
            Browser face engine
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Upload to {workspaceName}</h3>
            <p className="mt-1 text-sm text-slate-500">
              Originals stay untouched. Analysis runs in the browser, uploads stay private.
            </p>
          </div>
        </div>

        <div className={`rounded-full border px-3 py-1 text-xs ${statusTone}`}>
          {modelStatus === "ready" ? "Ready" : modelStatus === "loading" ? "Loading" : "Error"}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Processed", value: stats.processed },
          { label: "Uploaded", value: stats.uploaded },
          { label: "No-face", value: stats.noFace },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
            <div className="mt-2 text-3xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>

      {stats.total > 0 && (
        <div className="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{status}</span>
            <span>
              {stats.processed}/{stats.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-950 transition-all duration-300"
              style={{
                width: stats.total === 0 ? "0%" : `${Math.min((stats.processed / stats.total) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
            <div>Skipped: {stats.skipped}</div>
            <div>Errors: {stats.errors}</div>
            <div>No-face: {stats.noFace}</div>
          </div>
          <div className="space-y-2 rounded-[1.2rem] border border-slate-200 bg-white p-3 font-mono text-xs text-slate-500">
            {logs.length > 0 ? logs.map((log, index) => <div key={`${log}-${index}`}>{log}</div>) : <div>No upload activity yet.</div>}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <label
          className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[1.35rem] bg-slate-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 ${
            isUploading || modelStatus !== "ready" ? "pointer-events-none opacity-60" : ""
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
            disabled={isUploading || modelStatus !== "ready"}
          />
        </label>

        {isUploading && (
          <button
            type="button"
            onClick={() => {
              stopRef.current = true;
              addLog("Stop requested. Finishing current file.");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-[1.35rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            <AlertCircle className="h-4 w-4" />
            Stop
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
        <div className="inline-flex items-center gap-2">
          {modelStatus === "ready" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          {status}
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(historyKey);
            addLog("Local upload history cleared.");
          }}
          className="underline underline-offset-4 transition hover:text-slate-950"
        >
          Clear history
        </button>
      </div>
    </div>
  );
}
