"use client";

import { useRef, useState } from "react";
import { RefreshCcw, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  beginWorkspaceReprocess,
  finishWorkspaceReprocess,
  markWorkspacePhotoReprocessFailed,
  reprocessWorkspacePhoto,
} from "@/actions/reprocess";
import {
  filterReliableDetections,
  getFullFaceDescription,
} from "@/utils/faceApi";

interface ReprocessPhoto {
  id: string;
  url: string;
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

export default function ReprocessWorkspaceButton({
  workspaceId,
  workspaceName,
  photos,
}: ReprocessWorkspaceButtonProps) {
  const router = useRouter();
  const stopRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("Ready to rebuild");
  const [stats, setStats] = useState<ReprocessStats>({
    total: photos.length,
    processed: 0,
    faces: 0,
    failed: 0,
  });

  const updateStats = (patch: Partial<ReprocessStats>) => {
    setStats((current) => ({ ...current, ...patch }));
  };

  const handleReprocess = async () => {
    if (photos.length === 0) {
      alert("No photos to reprocess yet.");
      return;
    }

    if (
      !confirm(
        `Reprocess ${photos.length} photo${photos.length === 1 ? "" : "s"} in ${workspaceName}? This rebuilds the face index with the current browser model.`,
      )
    ) {
      return;
    }

    stopRef.current = false;
    setRunning(true);
    setStats({
      total: photos.length,
      processed: 0,
      faces: 0,
      failed: 0,
    });
    setStatus("Clearing old face index...");

    const startResult = await beginWorkspaceReprocess(workspaceId);
    if (!startResult.success) {
      setRunning(false);
      setStatus(startResult.error ?? "Could not start reprocess.");
      return;
    }

    let processed = 0;
    let faces = 0;
    let failed = 0;

    for (const photo of photos) {
      if (stopRef.current) {
        break;
      }

      try {
        setStatus(`Scanning ${processed + 1}/${photos.length}`);
        const { image, detections } = await getFullFaceDescription(photo.url);
        const reliableDetections = filterReliableDetections(detections, {
          imageWidth: image.width,
          imageHeight: image.height,
          minScore: 0.66,
          minAbsoluteFaceSize: 42,
          minRelativeFaceSize: 0.04,
        });
        const descriptors = reliableDetections.map((detection) => Array.from(detection.descriptor));

        const result = await reprocessWorkspacePhoto({
          workspaceId,
          photoId: photo.id,
          descriptors,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Reprocess failed");
        }

        processed += 1;
        faces += result.detectedFaces ?? descriptors.length;
      } catch (error) {
        console.error("Workspace photo reprocess failed:", error);
        await markWorkspacePhotoReprocessFailed(workspaceId, photo.id);
        processed += 1;
        failed += 1;
      }

      updateStats({ processed, faces, failed });
    }

    await finishWorkspaceReprocess(workspaceId);
    setRunning(false);
    setStatus(stopRef.current ? "Reprocess stopped" : "Reprocess complete");
    router.refresh();
  };

  return (
    <div className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            Model maintenance
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-950">Reprocess workspace</h3>
          <p className="mt-1 text-sm text-slate-500">Rebuild face groups after model upgrades.</p>
        </div>

        <button
          type="button"
          onClick={() => void handleReprocess()}
          disabled={running || photos.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          {running ? "Reprocessing" : "Reprocess images"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.3rem] bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Done</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {stats.processed}/{stats.total}
          </div>
        </div>
        <div className="rounded-[1.3rem] bg-slate-50 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Faces</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{stats.faces}</div>
        </div>
        <div className="rounded-[1.3rem] bg-slate-50 p-4">
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
                setStatus("Stopping after current image...");
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
