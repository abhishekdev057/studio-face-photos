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
        <section className="hero-surface px-6 py-8 sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-3">
              <div className="eyebrow-badge">Private guest access</div>
              <h1 className="max-w-[12ch] text-4xl font-semibold tracking-tight sm:max-w-none sm:text-5xl">
                {workspace.name}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                Camera scan only. Verified photos only.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {workspace._count.photos} indexed
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Camera only
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Private results
              </div>
            </div>
          </div>
        </section>

        <GuestSearch workspaceSlug={workspace.shareSlug} workspaceName={workspace.name} />
      </div>
    </div>
  );
}
