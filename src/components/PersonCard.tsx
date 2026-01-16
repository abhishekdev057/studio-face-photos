"use client"

import { Share2, User, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { deletePerson } from "@/actions/delete";
import { useRouter } from "next/navigation";

interface PersonCardProps {
    person: {
        id: string;
        faces: {
            photo: {
                url: string;
            }
        }[]
    }
}

export default function PersonCard({ person }: PersonCardProps) {
    const [copied, setCopied] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const router = useRouter();
    const coverUrl = person.faces[0]?.photo?.url;

    const handleCopyLink = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const link = `${window.location.origin}/guest?personId=${person.id}`;
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm("Are you sure you want to delete this album? This cannot be undone.")) return;

        setDeleting(true);
        const res = await deletePerson(person.id);
        if (res.success) {
            // Router refresh to update the list
            router.refresh();
        } else {
            alert("Failed to delete");
            setDeleting(false);
        }
    };

    if (deleting) return null; // Optimistic hide

    return (
        <div className="group relative aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-cyan-500/50 transition-all">
            {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="Person" className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                    <User className="w-8 h-8 text-zinc-700" />
                </div>
            )}

            {/* Clickable Overlay to Open Album */}
            <Link href={`/organizer/person/${person.id}`} className="absolute inset-0 z-10" />

            {/* Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                <div className="flex justify-between items-center pointer-events-auto">
                    <button
                        onClick={handleDelete}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-1.5 rounded-md backdrop-blur-md border border-red-500/20 transition hover:scale-105"
                        title="Delete Album"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleCopyLink}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-1.5 px-3 rounded-md backdrop-blur-md border border-zinc-700 flex items-center gap-2 transition active:scale-95"
                    >
                        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Share2 className="w-3 h-3" />}
                        {copied ? "Copied" : "Share"}
                    </button>
                </div>
            </div>
        </div>
    );
}
