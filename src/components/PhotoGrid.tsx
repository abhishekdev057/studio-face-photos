"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  faceCount: number;
}

interface PhotoGridProps {
  photos: Photo[];
}

export default function PhotoGrid({ photos }: PhotoGridProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setLightboxIndex((current) =>
          current !== null && current < photos.length - 1 ? current + 1 : current,
        );
      }
      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => (current !== null && current > 0 ? current - 1 : current));
      }
      if (event.key === "Escape") {
        setLightboxIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, photos.length]);

  return (
    <section className="surface-card space-y-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <ImageIcon className="h-5 w-5 text-slate-500" />
          Workspace Gallery
        </h3>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
          {photos.length} photo{photos.length === 1 ? "" : "s"}
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="surface-card-muted border-dashed px-6 py-14 text-center text-sm text-slate-500">
          No photos uploaded yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="group relative aspect-square overflow-hidden rounded-[1.4rem] border border-slate-200 bg-slate-50/80 text-left"
              onClick={() => setLightboxIndex(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-md">
                {photo.faceCount} face{photo.faceCount === 1 ? "" : "s"}
              </div>
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-3 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={() =>
              setLightboxIndex((current) => (current !== null && current > 0 ? current - 1 : current))
            }
            disabled={lightboxIndex === 0}
            className="absolute left-4 rounded-full p-4 text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-20"
          >
            <ChevronLeft className="h-10 w-10" />
          </button>

          <button
            onClick={() =>
              setLightboxIndex((current) =>
                current !== null && current < photos.length - 1 ? current + 1 : current,
              )
            }
            disabled={lightboxIndex === photos.length - 1}
            className="absolute right-4 rounded-full p-4 text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-20"
          >
            <ChevronRight className="h-10 w-10" />
          </button>

          <div className="flex max-h-[90vh] max-w-7xl flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photos[lightboxIndex].url}
              alt=""
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              {lightboxIndex + 1} / {photos.length} • {photos[lightboxIndex].faceCount} detected face
              {photos[lightboxIndex].faceCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
