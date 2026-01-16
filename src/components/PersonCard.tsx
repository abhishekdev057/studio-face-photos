"use client"

import { Share2, User, Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

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
    const coverUrl = person.faces[0]?.photo?.url;

    const handleCopyLink = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Generate a share link (for now, let's assume it links to the guest page with a pre-filled search or specific ID if we had that route)
        // Since we don't have a specific person view yet, maybe we link to a search result? 
        // Or better, per the user's issue, they probably expect to copy a link to THIS person's collection.
        // Let's copy a link like: /guest?personId={id} (we would need to implement filtering support on guest page)
        // For now, let's just simulate the action visually and copy the ID to clipboard.

        const link = `${window.location.origin}/guest?personId=${person.id}`;
        navigator.clipboard.writeText(link);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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

            {/* Clickable Overlay to Open Album (Placeholder for future detail view) */}
            <Link href={`/organizer/person/${person.id}`} className="absolute inset-0 z-10" />

            {/* Actions */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                <div className="flex justify-between items-end pointer-events-auto">
                    <span className="text-xs font-mono text-cyan-400">ID: {person.id.slice(0, 4)}</span>

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
