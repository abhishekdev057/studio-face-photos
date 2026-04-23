"use client";

import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { AlertCircle, Camera, Download, Eye, Loader2, ScanFace, Sparkles, X } from "lucide-react";
import { createCameraSearchVariants } from "@/utils/image";
import {
  ensureFaceModels,
  filterReliableDetections,
  getFullFaceDescription,
} from "@/utils/faceApi";

interface WorkspacePhoto {
  id: string;
  url: string;
  faceCount: number;
}

interface GuestSearchProps {
  workspaceSlug: string;
  workspaceName: string;
}

const DOMINANT_FACE_AREA_RATIO = 1.85;

type DetectionCandidate = {
  descriptor: Float32Array;
  detection: {
    score?: number;
    box: {
      area: number;
    };
  };
};

function pickPrimaryDetection<T extends DetectionCandidate>(detections: T[]) {
  if (detections.length === 0) {
    return null;
  }

  const ordered = [...detections].sort(
    (left, right) => right.detection.box.area - left.detection.box.area,
  );

  if (ordered.length === 1) {
    return ordered[0];
  }

  return ordered[0].detection.box.area >= ordered[1].detection.box.area * DOMINANT_FACE_AREA_RATIO
    ? ordered[0]
    : null;
}

function formatConfidenceLabel(confidence: string) {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1);
}

export default function GuestSearch({ workspaceSlug, workspaceName }: GuestSearchProps) {
  const webcamRef = useRef<Webcam>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [photos, setPhotos] = useState<WorkspacePhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultConfidence, setResultConfidence] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading face engine...");

  useEffect(() => {
    let cancelled = false;

    ensureFaceModels()
      .then(() => {
        if (!cancelled) {
          setModelLoaded(true);
          setStatus("Camera ready");
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setStatus("Face engine failed to load");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusTone = modelLoaded
    ? errorMessage
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status.toLowerCase().includes("failed")
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-500";

  const resetSearch = () => {
    setSearched(false);
    setPhotos([]);
    setPreviewImage(null);
    setCameraOpen(false);
    setSearching(false);
    setErrorMessage(null);
    setResultMessage(null);
    setResultConfidence(null);
    setStatus(modelLoaded ? "Camera ready" : "Loading face engine...");
  };

  const performSearch = async (descriptor: number[]) => {
    const response = await fetch(`/api/public-search/${workspaceSlug}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ descriptor }),
    });

    const rawResponse = await response.text();
    let result: {
      success: boolean;
      error?: string;
      photos?: WorkspacePhoto[];
      message?: string;
      confidence?: string;
      reason?: string;
    };

    try {
      result = JSON.parse(rawResponse) as {
        success: boolean;
        error?: string;
        photos?: WorkspacePhoto[];
      };
    } catch {
      throw new Error(
        response.ok
          ? "Search response was invalid. Please try again."
          : `Search request failed with status ${response.status}.`,
      );
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Search failed");
    }

    setPhotos(result.photos || []);
    setResultMessage(result.message ?? null);
    setResultConfidence(result.confidence ?? null);
    setSearched(true);
  };

  const processImage = async (imageSource: string) => {
    setErrorMessage(null);
    setResultMessage(null);
    setResultConfidence(null);
    setSearching(true);
    setCameraOpen(false);
    setPreviewImage(imageSource);
    setStatus("Reading camera frame...");

    let matched = false;

    try {
      const variants = await createCameraSearchVariants(imageSource);
      let multipleFacesSeen = false;
      let bestDescriptor: number[] | null = null;

      for (const [index, variant] of variants.entries()) {
        setStatus(index === 0 ? "Scanning live frame..." : "Refining camera scan...");

        try {
          const { image, detections } = await getFullFaceDescription(variant);
          const reliableDetections = filterReliableDetections(detections, {
            imageWidth: image.width,
            imageHeight: image.height,
            minScore: index <= 1 ? 0.62 : 0.5,
            minAbsoluteFaceSize: index <= 1 ? 48 : 34,
            minRelativeFaceSize: index <= 1 ? 0.04 : 0.024,
          });

          if (reliableDetections.length > 1) {
            multipleFacesSeen = true;
          }

          const primaryDetection = pickPrimaryDetection(reliableDetections);
          if (primaryDetection) {
            bestDescriptor = Array.from(primaryDetection.descriptor);
            break;
          }
        } catch (variantError) {
          console.error("Camera scan variant failed:", variantError);
        }
      }

      if (!bestDescriptor) {
        throw new Error(
          multipleFacesSeen
            ? "More than one face is visible. Keep only your face in the camera."
            : "Face not clear enough. Move closer, keep the camera at eye level, and avoid backlight.",
        );
      }

      setStatus("Matching your photos...");
      await performSearch(bestDescriptor);
      setStatus("Verified scan complete");
      matched = true;
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't finish the camera scan. Please try again.",
      );
      setStatus("Camera ready");
    } finally {
      setSearching(false);
      setPreviewImage(null);
      if (!matched) {
        setCameraOpen(true);
      }
    }
  };

  const handleCapture = async () => {
    if (!modelLoaded) {
      setErrorMessage("Face engine is still loading.");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
      setErrorMessage("Camera frame not available. Please try again.");
      return;
    }

    await processImage(imageSrc);
  };

  const downloadImage = async (url: string, filename: string, id: string) => {
    setDownloadingId(id);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 p-6 pb-0 lg:p-8 lg:pb-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
              <ScanFace className="h-3.5 w-3.5" />
              Live camera access
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Scan your face</h1>
            <p className="text-sm text-slate-500">
              {workspaceName}. Camera only. No gallery upload.
            </p>
          </div>

          <div className={`mx-6 mt-6 rounded-full border px-4 py-2 text-sm lg:mx-8 ${statusTone}`}>
            {status}
          </div>
        </div>

        <div className="mt-6 p-4 pt-0 lg:p-6 lg:pt-0">
          {cameraOpen ? (
            <div className="relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-slate-950 shadow-inner">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                forceScreenshotSourceSize
                mirrored
                screenshotQuality={1}
                videoConstraints={{
                  facingMode: "user",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                }}
                className="aspect-[16/9] max-h-[620px] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-8 rounded-[2rem] border border-white/20" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/40 shadow-[0_0_60px_rgba(103,232,249,0.16)]" />
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-full bg-black/45 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-cyan-100 backdrop-blur-md">
                    Keep your face inside the ring
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCapture()}
                    className="rounded-full bg-white p-1 shadow-2xl transition hover:scale-105"
                  >
                    <div className="h-16 w-16 rounded-full border-4 border-black bg-white" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setCameraOpen(true);
              }}
              disabled={searching}
              className="group relative flex min-h-[360px] w-full overflow-hidden rounded-[1.8rem] bg-slate-950 px-6 text-center text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(103,232,249,0.24),transparent_32%),linear-gradient(135deg,#020617,#0f172a)]" />
              <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/20 transition group-hover:scale-105" />
              <div className="relative z-10 m-auto flex flex-col items-center gap-5">
                <div className="rounded-full bg-white/10 p-5 shadow-[0_0_50px_rgba(103,232,249,0.16)]">
                  <Camera className="h-8 w-8" />
                </div>
                <div>
                  <div className="text-3xl font-semibold">Start camera</div>
                  <div className="mt-2 text-sm text-slate-300">Look straight. Tap once to scan.</div>
                </div>
              </div>
            </button>
          )}

          {errorMessage && (
            <div className="mt-4 flex items-start gap-3 rounded-[1.4rem] border border-amber-200 bg-amber-50 px-4 py-4 text-left text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Try one more scan</div>
                <div className="mt-1 leading-6">{errorMessage}</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {searching && previewImage && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-slate-950/98 backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.18),transparent_34%),linear-gradient(180deg,#020617,#050816)]" />
          <div className="absolute h-[34rem] w-[34rem] animate-scan-ring rounded-full border border-cyan-300/15" />
          <div className="absolute h-[25rem] w-[25rem] animate-scan-ring rounded-full border border-cyan-300/20 [animation-delay:350ms]" />
          <div className="relative overflow-hidden rounded-[2.2rem] border border-cyan-200/25 bg-slate-950 shadow-[0_0_90px_rgba(103,232,249,0.18)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Scanning camera frame"
              className="h-80 w-80 object-cover opacity-80 md:h-96 md:w-96"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(103,232,249,0.18),transparent_25%,transparent_75%,rgba(103,232,249,0.18))]" />
            <div className="absolute inset-x-0 top-0 h-1 animate-scan-vertical bg-cyan-300 shadow-[0_0_30px_rgba(103,232,249,0.95)]" />
            <div className="absolute inset-8 rounded-[2rem] border border-white/20" />
          </div>
          <div className="relative mt-8 flex items-center gap-3 text-cyan-100">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold uppercase tracking-[0.28em]">Matching your face</span>
          </div>
          <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            Private scan. Only matching photos appear.
          </div>
        </div>
      )}

      {searched && (
        <section className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                {photos.length > 0 ? `${photos.length} photos found` : "No photos found"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {resultMessage ||
                  (photos.length > 0
                    ? "Only verified photos are shown."
                    : "Try again with better light and one clear face.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {resultConfidence && resultConfidence !== "none" && (
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {formatConfidenceLabel(resultConfidence)} confidence
                </div>
              )}
              <button
                type="button"
                onClick={resetSearch}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              >
                Scan again
              </button>
            </div>
          </div>

          {photos.length > 0 ? (
            <div className="columns-1 gap-4 space-y-4 sm:columns-2 lg:columns-3 xl:columns-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative mb-4 break-inside-avoid overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(photo.url)}
                    className="block w-full text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt="Matched photo" className="w-full transition duration-500 group-hover:scale-[1.02]" />
                  </button>
                  <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100">
                    <div className="mb-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPhoto(photo.url)}
                        className="rounded-full bg-white/90 p-2.5 text-slate-700 backdrop-blur-md transition hover:bg-white"
                        title="View full image"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void downloadImage(photo.url, `photo-${photo.id}.jpg`, photo.id)}
                        disabled={downloadingId === photo.id}
                        className="rounded-full bg-white p-2.5 text-slate-950 shadow-lg transition hover:bg-cyan-50 disabled:opacity-60"
                        title="Download image"
                      >
                        {downloadingId === photo.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
              <div className="text-lg font-semibold text-slate-950">Nothing matched yet</div>
              <p className="mt-2 text-sm text-slate-500">
                {resultMessage || "We only show photos after a high-confidence match."}
              </p>
            </div>
          )}
        </section>
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2 text-white/70 transition hover:bg-white/20 hover:text-white"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedPhoto}
            alt="Selected photo"
            className="max-h-[90vh] max-w-full rounded-[1.4rem] object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
