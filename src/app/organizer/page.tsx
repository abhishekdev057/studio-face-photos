import { prisma } from "@/lib/prisma";
import UploadForm from "@/components/UploadForm";
import PersonCard from "@/components/PersonCard";
import ResetButton from "@/components/ResetButton";
import Link from "next/link";
import { User, Image as ImageIcon, Sparkles, LayoutGrid } from "lucide-react";

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
        console.error("DB Error:", e);
    }

    return (
        <div className="min-h-screen p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-enter">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
                        Event Dashboard
                    </h1>
                    <p className="text-zinc-400">Manage your collection and view AI insights.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <ResetButton />
                    <Link href="/guest" className="glass-button px-4 py-2 rounded-lg text-sm text-zinc-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Simulate Guest View
                    </Link>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-cyan-500/30 transition-colors">
                    <div>
                        <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider mb-1">Total Photos</p>
                        <h2 className="text-4xl font-bold text-white group-hover:text-cyan-400 transition-colors">{stats.photos}</h2>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                        <ImageIcon className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
                    </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-blue-500/30 transition-colors">
                    <div>
                        <p className="text-zinc-500 text-sm font-medium uppercase tracking-wider mb-1">Unqiue People</p>
                        <h2 className="text-4xl font-bold text-white group-hover:text-blue-400 transition-colors">{stats.people}</h2>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <User className="w-6 h-6 text-zinc-400 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Upload Section */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="glass-panel p-1 rounded-2xl">
                        <UploadForm />
                    </div>
                </div>

                {/* Right: Detected People */}
                <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <LayoutGrid className="text-cyan-400 w-5 h-5" />
                            Recognized Guests
                        </h3>
                        <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                            Recent Activity
                        </span>
                    </div>


                    {people.length === 0 ? (
                        <div className="glass-panel p-12 rounded-2xl border-dashed border-2 border-zinc-800 flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
                                <User className="w-8 h-8 text-zinc-600" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-zinc-300">No Guests Found Yet</h4>
                                <p className="text-zinc-500 max-w-xs mx-auto mt-2">Upload photos from your event. Our AI will automatically identify and group recurring faces here.</p>
                            </div>
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
