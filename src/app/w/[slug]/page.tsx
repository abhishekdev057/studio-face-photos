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
    <div className="page-shell min-h-screen py-8 text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="hero-surface px-6 py-8">
          <div className="space-y-3">
            <div className="eyebrow-badge">
              Private guest access
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="max-w-2xl text-sm text-slate-500">
              Camera scan only. We only surface photos after a strict verification pass.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {workspace._count.photos} photos indexed
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Verified match only
              </div>
            </div>
          </div>
        </section>

        <GuestSearch workspaceSlug={workspace.shareSlug} workspaceName={workspace.name} />
      </div>
    </div>
  );
}
