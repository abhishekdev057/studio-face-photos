import { prisma } from "@/lib/prisma";
import UploadForm from "@/components/UploadForm";
import PersonCard from "@/components/PersonCard";
import Link from "next/link";

import { Share2, User } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function OrganizerPage() {
    let stats = { photos: 0, people: 0 };
    let people: any[] = [];

    try {
        stats.photos = await prisma.photo.count();
        stats.people = await prisma.person.count();

        people = await prisma.person.findMany({
            take: 50,
            orderBy: { createdAt: 'desc' },
            include: {
                faces: {
                    take: 1,
                    include: { photo: true }
                }
            }
        });

    } catch (e) {
        console.error("DB Error (Setup likely incomplete or network block):", e);
    }

    return (
        <div className="min-h-screen bg-background text-white p-8">
            <header className="mb-8 flex justify-between items-center border-b border-zinc-800 pb-4">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600">
                    Organizer Dashboard
                </h1>
                <div className="space-x-4">
                    <Link href="/" className="text-zinc-400 hover:text-white transition-colors">Home</Link>
                    <Link href="/guest" className="text-zinc-400 hover:text-white transition-colors">Guest View (Test)</Link>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition">
                    <h2 className="text-4xl font-black text-white">{stats.photos}</h2>
                    <p className="text-zinc-500 uppercase tracking-widest text-xs mt-1">Total Photos</p>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-xl hover:border-zinc-700 transition">
                    <h2 className="text-4xl font-black text-white">{stats.people}</h2>
                    <p className="text-zinc-500 uppercase tracking-widest text-xs mt-1">Unique People Identified</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <UploadForm />
                </div>

                <div className="lg:col-span-2">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <User className="text-cyan-400" /> Detected People
                    </h3>

                    {people.length === 0 ? (
                        <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-600">
                            No people detected yet. Upload photos to start AI analysis.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {people.map(person => (
                                <PersonCard key={person.id} person={person} />
                            ))}
                        </div>

                    )}
                </div>
            </div>
        </div>
    );
}
