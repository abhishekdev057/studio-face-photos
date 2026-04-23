import { redirect } from "next/navigation";
import { Camera, ExternalLink, FolderKanban, Image as ImageIcon, Shield, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  canManageWorkspace,
  canUploadWorkspace,
  getAccessibleWorkspaces,
  getOrCreateWorkspacePublicLink,
  getWorkspaceForUserBySlug,
  isAdmin,
} from "@/lib/workspaces";
import UploadForm from "@/components/UploadForm";
import PersonCard from "@/components/PersonCard";
import ResetButton from "@/components/ResetButton";
import PhotoGrid from "@/components/PhotoGrid";
import WorkspaceCreateForm from "@/components/WorkspaceCreateForm";
import WorkspaceAccessManager from "@/components/WorkspaceAccessManager";
import CopyLinkButton from "@/components/CopyLinkButton";
import ReprocessWorkspaceButton from "@/components/ReprocessWorkspaceButton";

export const dynamic = "force-dynamic";

interface OrganizerPageProps {
  searchParams: Promise<{ workspace?: string | string[] }>;
}

function formatRole(role: string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

function formatGlobalRole(role: string) {
  if (role === "ADMIN") {
    return "System admin";
  }

  if (role === "ORGANIZER") {
    return "Organizer";
  }

  return "Viewer";
}

export default async function OrganizerPage({ searchParams }: OrganizerPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role === "VIEWER") {
    redirect("/guest");
  }

  const workspaces = await getAccessibleWorkspaces(session.user.id, session.user.role);
  const params = await searchParams;
  const requestedWorkspace =
    typeof params.workspace === "string" && params.workspace.length > 0
      ? params.workspace
      : undefined;

  const activeWorkspaceSlug = requestedWorkspace ?? workspaces[0]?.slug;
  const activeWorkspace = activeWorkspaceSlug
    ? await getWorkspaceForUserBySlug({
        slug: activeWorkspaceSlug,
        userId: session.user.id,
        globalRole: session.user.role,
      })
    : null;

  const currentMembershipRole =
    activeWorkspace?.members.find((member) => member.user.id === session.user.id)?.role ?? null;
  const canManageActiveWorkspace = Boolean(
    activeWorkspace &&
      canManageWorkspace({
        globalRole: session.user.role,
        ownerId: activeWorkspace.ownerId,
        userId: session.user.id,
        membershipRole: currentMembershipRole,
      }),
  );
  const canUploadActiveWorkspace = Boolean(
    activeWorkspace &&
      canUploadWorkspace({
        globalRole: session.user.role,
        ownerId: activeWorkspace.ownerId,
        userId: session.user.id,
        membershipRole: currentMembershipRole,
      }),
  );

  const [people, photos, reprocessPhotos, faceCount, noFaceCount, publicLink] = activeWorkspace
    ? await Promise.all([
        prisma.person.findMany({
          where: { eventId: activeWorkspace.id },
          take: 24,
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          include: {
            faces: {
              take: 1,
              include: {
                photo: {
                  select: { url: true },
                },
              },
            },
            _count: {
              select: { faces: true },
            },
          },
        }),
        prisma.photo.findMany({
          where: { eventId: activeWorkspace.id },
          orderBy: { createdAt: "desc" },
          take: 150,
          select: {
            id: true,
            url: true,
            faceCount: true,
          },
        }),
        prisma.photo.findMany({
          where: { eventId: activeWorkspace.id },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            url: true,
          },
        }),
        prisma.face.count({
          where: {
            photo: {
              eventId: activeWorkspace.id,
            },
          },
        }),
        prisma.photo.count({
          where: {
            eventId: activeWorkspace.id,
            analysisStatus: "NO_FACE",
          },
        }),
        getOrCreateWorkspacePublicLink(activeWorkspace.id),
      ])
    : [[], [], [], 0, 0, null];

  const personCards = people.map((person) => ({
    id: person.id,
    name: person.name,
    faceCount: person._count.faces,
    coverUrl: person.faces[0]?.photo.url ?? null,
  }));

  const signedInName = session.user.name || session.user.email || "Organizer";
  const workspaceAccessLabel = isAdmin(session.user.role)
    ? "System admin access"
    : currentMembershipRole
      ? formatRole(currentMembershipRole)
      : formatGlobalRole(session.user.role);

  return (
    <div className="page-shell py-8">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="surface-card p-6">
            <div className="eyebrow-badge">
              <FolderKanban className="h-3.5 w-3.5" />
              Control room
            </div>

            <div className="mt-5 space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Organizer workspace</h1>
              <p className="text-sm leading-6 text-slate-500">
                Upload, review faces, and share one secure guest link.
              </p>
            </div>

            <div className="mt-6 rounded-[1.6rem] bg-slate-950 p-5 text-white shadow-[0_24px_60px_rgba(8,18,36,0.2)]">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Signed in</div>
              <div className="mt-2 text-lg font-semibold">{signedInName}</div>
              <div className="mt-1 text-sm text-slate-300">{session.user.email}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="surface-card-muted p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Workspaces</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{workspaces.length}</div>
              </div>
              <div className="surface-card-muted p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Role</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {formatGlobalRole(session.user.role)}
                </div>
              </div>
            </div>
          </section>

          <WorkspaceCreateForm />

          <section className="surface-card p-4">
            <div className="flex items-center justify-between gap-3 px-2 pb-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Your workspaces</div>
                <p className="text-sm text-slate-500">Pick one to manage.</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                {workspaces.length}
              </div>
            </div>

            {workspaces.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No workspace access yet.
              </div>
            ) : (
              <div className="space-y-3">
                {workspaces.map((workspace) => {
                  const isActive = workspace.slug === activeWorkspace?.slug;
                  const membershipRole = isAdmin(session.user.role)
                    ? "ADMIN"
                    : workspace.ownerId === session.user.id
                      ? "OWNER"
                      : workspace.members[0]?.role ?? "VIEWER";

                  return (
                    <a
                      key={workspace.id}
                      href={`/organizer?workspace=${workspace.slug}`}
                      className={`block rounded-[1.5rem] border px-4 py-4 transition ${
                        isActive
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                          : "border-slate-200 bg-slate-50/80 text-slate-950 hover:border-slate-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{workspace.name}</div>
                          <div
                            className={`mt-1 text-xs uppercase tracking-[0.18em] ${
                              isActive ? "text-slate-300" : "text-slate-400"
                            }`}
                          >
                            {membershipRole === "ADMIN" ? "System admin" : formatRole(membershipRole)}
                          </div>
                        </div>
                        <div
                          className={`rounded-full px-2.5 py-1 text-[11px] ${
                            isActive ? "bg-white/10 text-slate-200" : "bg-white text-slate-500"
                          }`}
                        >
                          {workspace._count.photos} photos
                        </div>
                      </div>
                      <div
                        className={`mt-3 flex items-center gap-4 text-xs ${
                          isActive ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        <span>{workspace._count.people} guest groups</span>
                        <span>{workspace._count.members} members</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </aside>

        <main className="space-y-6">
          {!activeWorkspace ? (
            <section className="surface-card border-dashed px-6 py-16 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
                <Camera className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-3xl font-semibold text-slate-950">Create your first workspace</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                Start one workspace per event, client, or gallery pipeline.
              </p>
            </section>
          ) : (
            <>
              <section className="hero-surface p-6">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="eyebrow-badge">
                      Active workspace
                    </div>
                    <div>
                      <h2 className="text-4xl font-semibold tracking-tight text-slate-950">
                        {activeWorkspace.name}
                      </h2>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                        {activeWorkspace.description ||
                          "Original uploads, strict verification, and one private camera-only guest link."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Owner {activeWorkspace.owner.name || activeWorkspace.owner.email || "Unknown"}
                      </div>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {workspaceAccessLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      href={publicLink ? `/w/${publicLink.slug}` : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-disabled={!publicLink}
                      className="action-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open guest link
                    </a>
                    {publicLink && (
                      <CopyLinkButton
                        path={`/w/${publicLink.slug}`}
                        label="Copy guest link"
                        copiedLabel="Guest link copied"
                        className="action-secondary"
                      />
                    )}
                    <CopyLinkButton
                      path={`/organizer?workspace=${activeWorkspace.slug}`}
                      label="Copy organizer link"
                      copiedLabel="Organizer link copied"
                      className="action-secondary"
                    />
                    {canManageActiveWorkspace && (
                      <ResetButton workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} />
                    )}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Photos",
                    value: activeWorkspace._count.photos,
                    icon: ImageIcon,
                  },
                  {
                    label: "Guest groups",
                    value: activeWorkspace._count.people,
                    icon: Users,
                  },
                  {
                    label: "Recognized faces",
                    value: faceCount,
                    icon: Camera,
                  },
                  {
                    label: "No-face uploads",
                    value: noFaceCount,
                    icon: FolderKanban,
                  },
                ].map((metric) => (
                  <div
                    key={metric.label}
                    className="metric-card"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{metric.label}</div>
                      <metric.icon className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-4 text-4xl font-semibold text-slate-950">{metric.value}</div>
                  </div>
                ))}
              </section>

              <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                {canUploadActiveWorkspace ? (
                  <UploadForm workspaceId={activeWorkspace.id} workspaceName={activeWorkspace.name} />
                ) : (
                  <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
                    Upload access is limited to this workspace team.
                  </div>
                )}

                {canManageActiveWorkspace ? (
                  <WorkspaceAccessManager
                    workspaceId={activeWorkspace.id}
                    ownerId={activeWorkspace.ownerId}
                    currentUserId={session.user.id}
                    members={activeWorkspace.members.map((member) => ({
                      userId: member.user.id,
                      name: member.user.name,
                      email: member.user.email,
                      image: member.user.image,
                      role: member.role,
                    }))}
                    invites={activeWorkspace.invites.map((invite) => ({
                      id: invite.id,
                      email: invite.email,
                      role: invite.role,
                      createdAt: invite.createdAt.toISOString(),
                    }))}
                  />
                ) : (
                  <div className="surface-card p-6">
                    <div className="eyebrow-badge">
                      <Shield className="h-3.5 w-3.5" />
                      Access
                    </div>
                    <div className="mt-4 text-lg font-semibold text-slate-950">Managed by owner or manager</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Contributors can upload and review results here, but team access and reset actions stay locked.
                    </p>
                  </div>
                )}
              </section>

              {canManageActiveWorkspace && (
                <ReprocessWorkspaceButton
                  workspaceId={activeWorkspace.id}
                  workspaceName={activeWorkspace.name}
                  photos={reprocessPhotos}
                />
              )}

              <section className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-slate-950">Guest groups</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Matched clusters inside {activeWorkspace.name}.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                    {personCards.length} shown
                  </div>
                </div>

                {personCards.length === 0 ? (
                  <div className="surface-card border-dashed px-6 py-14 text-center text-slate-500">
                    No guest groups yet.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {personCards.map((person) => (
                      <PersonCard
                        key={person.id}
                        workspaceId={activeWorkspace.id}
                        workspaceSlug={activeWorkspace.slug}
                        person={person}
                        canManage={canManageActiveWorkspace}
                      />
                    ))}
                  </div>
                )}
              </section>

              <PhotoGrid photos={photos} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
