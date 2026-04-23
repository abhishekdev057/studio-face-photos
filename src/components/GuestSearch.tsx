"use client";

import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera, Download, Eye, Loader2, ScanFace, Upload, X } from "lucide-react";
import { resizeImage } from "@/utils/image";
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
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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
  const [status, setStatus] = useState("Loading face engine...");

  useEffect(() => {
    let cancelled = false;

    ensureFaceModels()
      .then(() => {
        if (!cancelled) {
          setModelLoaded(true);
          setStatus("Selfie search ready");
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
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status.toLowerCase().includes("failed")
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-500";

  const resetSearch = () => {
    setSearched(false);
    setPhotos([]);
    setPreviewImage(null);
    setCameraOpen(false);
    setSearching(false);
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
    setSearched(true);
  };

  const processImage = async (imageSource: string | Blob) => {
    const previewUrl =
      typeof imageSource === "string" ? imageSource : URL.createObjectURL(imageSource);

    setSearching(true);
    setCameraOpen(false);
    setPreviewImage(previewUrl);

    try {
      const { image, detections } = await getFullFaceDescription(imageSource);
      const reliableDetections = filterReliableDetections(detections, {
        imageWidth: image.width,
        imageHeight: image.height,
        minScore: 0.72,
        minAbsoluteFaceSize: 64,
        minRelativeFaceSize: 0.07,
      });

      if (reliableDetections.length === 0) {
        throw new Error("No clear face found. Try a brighter, front-facing selfie.");
      }

      const primaryDetection = pickPrimaryDetection(reliableDetections);
      if (!primaryDetection) {
        throw new Error("Use a photo with one face only, or keep your face much closer than everyone else.");
      }

      await performSearch(Array.from(primaryDetection.descriptor));
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "We couldn't finish the selfie match. Please try again.",
      );
    } finally {
      setSearching(false);
      setPreviewImage(null);
      if (typeof imageSource !== "string") {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    if (!modelLoaded) {
      alert("Face engine is still loading.");
      return;
    }

    const file = event.target.files[0];
    event.target.value = "";

    if (file.size > MAX_UPLOAD_BYTES) {
      alert("Keep uploads below 25 MB.");
      return;
    }

    try {
      const resizedBlob = await resizeImage(file, 1280);
      await processImage(resizedBlob);
    } catch (error) {
      console.error(error);
      alert("We couldn't prepare that selfie. Please try another one.");
    }
  };

  const handleCapture = async () => {
    if (!modelLoaded) {
      alert("Face engine is still loading.");
      return;
    }

    const imageSrc = webcamRef.current?.getScreenshot();
    if (!imageSrc) {
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
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600">
              <ScanFace className="h-3.5 w-3.5" />
              Selfie access only
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Find your photos</h1>
            <p className="text-sm text-slate-500">
              {workspaceName}. Upload one selfie or use the camera.
            </p>
          </div>

          <div className={`rounded-full border px-4 py-2 text-sm ${statusTone}`}>
            {status}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <label className="group relative flex min-h-52 cursor-pointer flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-slate-400 hover:bg-slate-100">
            <div className="rounded-full bg-white p-4 shadow-sm">
              <Upload className="h-6 w-6 text-slate-700" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">Upload selfie</div>
              <div className="mt-1 text-sm text-slate-500">One clear face.</div>
            </div>
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleUpload}
              disabled={searching}
            />
          </label>

          <div className="flex items-center justify-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            or
          </div>

          {cameraOpen ? (
            <div className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-black">
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                className="aspect-video w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleCapture()}
                  className="rounded-full bg-white p-1 shadow-2xl transition hover:scale-105"
                >
                  <div className="h-16 w-16 rounded-full border-4 border-black bg-white" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              disabled={searching}
              className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-[1.6rem] border border-slate-200 bg-slate-950 px-6 text-center text-white transition hover:bg-slate-900 disabled:opacity-60"
            >
              <div className="rounded-full bg-white/10 p-4">
                <Camera className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-semibold">Use camera</div>
                <div className="mt-1 text-sm text-slate-300">Take a live selfie.</div>
              </div>
            </button>
          )}
        </div>
      </section>

      {searching && previewImage && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-2xl">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImage} alt="Scanning selfie" className="h-80 w-80 object-cover opacity-70" />
            <div className="absolute inset-x-0 top-0 h-0.5 animate-scan-vertical bg-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.95)]" />
          </div>
          <div className="mt-8 flex items-center gap-3 text-cyan-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-semibold uppercase tracking-[0.24em]">Scanning</span>
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
                {photos.length > 0
                  ? "Only your matched photos are shown."
                  : "Try another selfie with better light and one clear face."}
              </p>
            </div>

            <button
              type="button"
              onClick={resetSearch}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            >
              Try another selfie
            </button>
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
