import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, User, ImageIcon } from "lucide-react";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
    const { id } = await params;

    const person = await prisma.person.findUnique({
        where: { id },
        include: {
            faces: {
                include: {
                    photo: true
                }
            }
        }
    });

    if (!person) {
        notFound();
    }

    // Extract unique photos from faces (deduplicate if person appears multiple times in one photo)
    const uniquePhotosMap = new Map();
    person.faces.forEach(face => {
        if (face.photo && !uniquePhotosMap.has(face.photo.id)) {
            uniquePhotosMap.set(face.photo.id, face.photo);
        }
    });
    const photos = Array.from(uniquePhotosMap.values());


    return (
        <div className="min-h-screen bg-background text-white p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
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
                        <div key={photo.id} className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.url}
                                alt="Event Photo"
                                className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                <a
                                    href={photo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-white hover:underline truncate w-full"
                                >
                                    View Full
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
