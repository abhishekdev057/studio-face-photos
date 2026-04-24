import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Camera, FolderKanban, Shield, Users } from "lucide-react";
import { auth } from "@/auth";
import WorkspaceCreateForm from "@/components/WorkspaceCreateForm";
import WorkspaceDirectory from "@/components/WorkspaceDirectory";
import {
  formatGlobalRole,
  getAccessibleWorkspaces,
  getOrganizerWorkspacePath,
} from "@/lib/workspaces";

export const dynamic = "force-dynamic";

interface OrganizerPageProps {
  searchParams: Promise<{ workspace?: string | string[] }>;
}

export default async function OrganizerPage({ searchParams }: OrganizerPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role === "VIEWER") {
    redirect("/guest");
  }

  const params = await searchParams;
  const requestedWorkspace =
    typeof params.workspace === "string" && params.workspace.length > 0 ? params.workspace : null;
  if (requestedWorkspace) {
    redirect(getOrganizerWorkspacePath(requestedWorkspace));
  }

  const workspaces = await getAccessibleWorkspaces(session.user.id, session.user.role);
  const signedInName = session.user.name || session.user.email || "Organizer";

  const totals = workspaces.reduce(
    (summary, workspace) => ({
      photos: summary.photos + workspace._count.photos,
      groups: summary.groups + workspace._count.people,
      members: summary.members + workspace._count.members,
      invites: summary.invites + workspace._count.invites,
    }),
    { photos: 0, groups: 0, members: 0, invites: 0 },
  );

  const latestWorkspace = workspaces[0] ?? null;

  return (
    <div className="page-shell py-6 sm:py-8">
      <div className="space-y-6">
        <section className="hero-surface p-6 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:items-end">
            <div className="space-y-5">
              <div className="eyebrow-badge">
                <FolderKanban className="h-3.5 w-3.5" />
                Control room
              </div>

              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  Keep workspace operations clear from one clean dashboard.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px]">
                  Start here, create a workspace, then open its dedicated page for uploads, team access,
                  reprocessing, guest groups, and gallery review.
                </p>
              </div>

              {latestWorkspace ? (
                <div className="flex flex-wrap gap-3">
                  <Link href={getOrganizerWorkspacePath(latestWorkspace.slug)} className="action-primary">
                    Open latest workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <div className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                    {latestWorkspace.name}
                  </div>
                </div>
              ) : (
                <div className="inline-flex w-fit items-center rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                  Create your first workspace to start indexing photos.
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.7rem] bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(8,18,36,0.2)]">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in</div>
                <div className="mt-3 text-xl font-semibold">{signedInName}</div>
                <div className="mt-1 text-sm text-slate-300">{session.user.email}</div>
              </div>

              <div className="surface-card-muted p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Access level</div>
                <div className="mt-3 text-lg font-semibold text-slate-950">
                  {formatGlobalRole(session.user.role)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Workspaces open as dedicated pages so actions stay focused and easier to manage.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Workspaces", value: workspaces.length, icon: FolderKanban },
              { label: "Photos indexed", value: totals.photos, icon: Camera },
              { label: "Guest groups", value: totals.groups, icon: Users },
              { label: "Pending invites", value: totals.invites, icon: Shield },
            ].map((metric) => (
              <div key={metric.label} className="metric-card">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
                  <metric.icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="mt-4 text-4xl font-semibold text-slate-950">{metric.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
          <WorkspaceCreateForm />
          <WorkspaceDirectory
            workspaces={workspaces}
            currentUserId={session.user.id}
            globalRole={session.user.role}
            title="Your workspaces"
            description="Each workspace opens in its own focused control page."
          />
        </section>
      </div>
    </div>
  );
}
