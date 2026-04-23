import { notFound } from "next/navigation";
import GuestSearch from "@/components/GuestSearch";
import { getWorkspaceByPublicSlug, recordWorkspacePublicView } from "@/lib/workspaces";

interface PublicWorkspacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PublicWorkspacePage({ params }: PublicWorkspacePageProps) {
  const { slug } = await params;
  const workspace = await getWorkspaceByPublicSlug(slug);

  if (!workspace) {
    notFound();
  }

  await recordWorkspacePublicView(slug);

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-slate-950 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Private guest access
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Selfie search only. No public gallery.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {workspace._count.photos} photos indexed
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Private match flow
              </div>
            </div>
          </div>
        </section>

        <GuestSearch workspaceSlug={workspace.shareSlug} workspaceName={workspace.name} />
      </div>
    </div>
  );
}
