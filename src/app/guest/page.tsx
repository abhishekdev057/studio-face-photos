import GuestSearch from "@/components/GuestSearch";
import { getPersonPhotos, getAllPhotos } from "@/actions/gallery";

interface GuestPageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function GuestPage({ searchParams }: GuestPageProps) {
    const params = await searchParams;
    const personId = params.personId as string | undefined;
    const viewMode = params.view as string | undefined; // 'all'

    let initialPhotos: any[] = [];
    let mode: 'search' | 'shared' | 'all' = 'search';

    if (personId) {
        const res = await getPersonPhotos(personId);
        if (res.success && res.photos) {
            initialPhotos = res.photos;
            mode = 'shared';
        }
    } else if (viewMode === 'all') {
        const res = await getAllPhotos();
        if (res.success && res.photos) {
            initialPhotos = res.photos;
            mode = 'all';
        }
    }

    return (
        <div className="min-h-screen bg-background text-white p-4 md:p-8">
            <header className="mb-12 flex justify-center items-center text-zinc-500 gap-6">
                <div>Wedding Guest View</div>
                {mode !== 'all' && (
                    <a href="/guest?view=all" className="text-xs border border-zinc-800 px-3 py-1 rounded-full hover:bg-zinc-800 transition">
                        View Full Gallery
                    </a>
                )}
            </header>


            <div className="max-w-6xl mx-auto">
                {mode === 'search' && (
                    <div className="text-center mb-12 space-y-4">
                        <h1 className="text-4xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500">
                            Find Your Moments
                        </h1>
                        <p className="text-xl text-zinc-400">
                            Using advanced face recognition to build your personal album.
                        </p>
                    </div>
                )}

                <GuestSearch initialPhotos={initialPhotos} mode={mode} />
            </div>
        </div>
    );
}

