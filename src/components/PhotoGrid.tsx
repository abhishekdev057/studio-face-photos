"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Check, Image as ImageIcon } from "lucide-react";

interface Photo {
    id: string;
    url: string;
}

interface PhotoGridProps {
    photos: Photo[];
}

export default function PhotoGrid({ photos }: PhotoGridProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Navigation handlers
    const nextPhoto = useCallback(() => {
        setLightboxIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : prev));
    }, [photos.length]);

    const prevPhoto = useCallback(() => {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
    }, []);

    // Keyboard support
    useEffect(() => {
        if (lightboxIndex === null) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") nextPhoto();
            if (e.key === "ArrowLeft") prevPhoto();
            if (e.key === "Escape") setLightboxIndex(null);
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [lightboxIndex, nextPhoto, prevPhoto]);

    // Selection toggle
    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                <ImageIcon className="text-blue-400 w-5 h-5" />
                All Photos ({photos.length})
            </h3>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {photos.map((photo, index) => {
                    const isSelected = selectedIds.has(photo.id);
                    return (
                        <div
                            key={photo.id}
                            className={`relative aspect-square group cursor-pointer overflow-hidden rounded-lg bg-zinc-900 border-2 transition-colors ${isSelected ? 'border-cyan-500' : 'border-transparent'}`}
                            onClick={() => setLightboxIndex(index)}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.url}
                                alt=""
                                loading="lazy"
                                className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isSelected ? 'opacity-80' : ''}`}
                            />

                            {/* Selection Checkbox */}
                            <button
                                onClick={(e) => toggleSelection(e, photo.id)}
                                className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border transition-all z-10 
                                    ${isSelected ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-black/40 border-white/50 text-transparent hover:border-white'}`}
                            >
                                <Check className="w-3 h-3" />
                            </button>

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        </div>
                    );
                })}
            </div>

            {/* Lightbox */}
            {lightboxIndex !== null && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200">
                    {/* Close Button */}
                    <button
                        onClick={() => setLightboxIndex(null)}
                        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-colors z-50"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Navigation Buttons */}
                    <button
                        onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                        disabled={lightboxIndex === 0}
                        className="absolute left-4 p-4 text-white/50 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded-full transition-all"
                    >
                        <ChevronLeft className="w-10 h-10" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                        disabled={lightboxIndex === photos.length - 1}
                        className="absolute right-4 p-4 text-white/50 hover:text-white disabled:opacity-20 hover:bg-white/5 rounded-full transition-all"
                    >
                        <ChevronRight className="w-10 h-10" />
                    </button>

                    {/* Main Image */}
                    <div className="relative max-w-7xl max-h-[90vh] p-4 flex flex-col items-center gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={photos[lightboxIndex].url}
                            alt=""
                            className="max-h-[80vh] w-auto max-w-full rounded-md shadow-2xl object-contain"
                        />

                        {/* Toolbar in Lightbox */}
                        <div className="flex items-center gap-4">
                            <span className="text-zinc-500 font-mono text-sm">
                                {lightboxIndex + 1} / {photos.length}
                            </span>

                            <button
                                onClick={(e) => toggleSelection(e, photos[lightboxIndex].id)}
                                className={`px-4 py-2 rounded-full border flex items-center gap-2 text-sm font-medium transition-colors
                                    ${selectedIds.has(photos[lightboxIndex].id)
                                        ? 'bg-cyan-500 border-cyan-500 text-black'
                                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'}`}
                            >
                                <Check className="w-4 h-4" />
                                {selectedIds.has(photos[lightboxIndex].id) ? 'Selected' : 'Select for Album'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
