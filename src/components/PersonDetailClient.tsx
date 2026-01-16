"use client"

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, ImageIcon, Trash2, Check, Share2, ExternalLink } from "lucide-react";
import { deletePerson, deletePhoto } from "@/actions/delete";
import { useRouter } from "next/navigation";

interface PersonDetailClientProps {
    person: {
        id: string;
    };
    initialPhotos: any[];
}

export default function PersonDetailClient({ person, initialPhotos }: PersonDetailClientProps) {
    const [photos, setPhotos] = useState(initialPhotos);
    const [deletingAlbum, setDeletingAlbum] = useState(false);
    const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const router = useRouter();

    const handleCopyLink = () => {
        const link = `${window.location.origin}/guest?personId=${person.id}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteAlbum = async () => {
        if (!confirm("Are you sure you want to delete this ENTIRE album? This action cannot be undone.")) return;
        setDeletingAlbum(true);
        const res = await deletePerson(person.id);
        if (res.success) {
            router.push("/organizer");
        } else {
            alert("Failed to delete album");
            setDeletingAlbum(false);
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        if (!confirm("Delete this photo?")) return;
        setDeletingPhotoId(photoId);
        const res = await deletePhoto(photoId);
        if (res.success) {
            setPhotos(photos.filter(p => p.id !== photoId));
            router.refresh(); // Refresh server data too (revalidatePath)
        } else {
            alert("Failed to delete photo");
        }
        setDeletingPhotoId(null);
    };

    return (
        <div className="min-h-screen bg-background text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/organizer"
                            className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition"
                        >
                            <ArrowLeft className="w-5 h-5 text-zinc-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <User className="text-cyan-400" />
                                Person Details
                            </h1>
                            <p className="text-zinc-500 font-mono text-sm">ID: {person.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-sm font-medium"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                            {copied ? "Copied Link" : "Share Album"}
                        </button>

                        <button
                            onClick={handleDeleteAlbum}
                            disabled={deletingAlbum}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition text-sm font-medium disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            {deletingAlbum ? "Deleting..." : "Delete Album"}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                    <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl">
                        <div className="text-3xl font-bold text-white mb-1">{photos.length}</div>
                        <div className="text-xs text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Photos Found
                        </div>
                    </div>
                </div>

                {/* Gallery */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {photos.map((photo) => (
                        <div key={photo.id} className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-cyan-500/50 transition-all">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.url}
                                alt="Event Photo"
                                className={`object-cover w-full h-full transition-opacity ${deletingPhotoId === photo.id ? 'opacity-20' : 'opacity-80 group-hover:opacity-100'}`}
                            />

                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                <button
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    disabled={deletingPhotoId === photo.id}
                                    className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-md shadow-lg backdrop-blur-sm transition"
                                    title="Delete Photo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                <a
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-white hover:underline truncate w-full pointer-events-auto flex items-center gap-1"
                                >
                                    <ExternalLink className="w-3 h-3" /> View Full
                                </a>
                            </div>
                        </div>
                    ))}
                </div>

                {photos.length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                        No photos found for this person.
                    </div>
                )}
            </div>
        </div>
    );
}
