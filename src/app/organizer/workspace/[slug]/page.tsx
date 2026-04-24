import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  FolderKanban,
  Image as ImageIcon,
  Shield,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  canManageWorkspace,
  canUploadWorkspace,
  formatGlobalRole,
  formatWorkspaceRole,
  getOrCreateWorkspacePublicLink,
  getOrganizerWorkspacePath,
  getWorkspaceForUserBySlug,
  isAdmin,
} from "@/lib/workspaces";
import UploadForm from "@/components/UploadForm";
import PersonCard from "@/components/PersonCard";
import ResetButton from "@/components/ResetButton";
import PhotoGrid from "@/components/PhotoGrid";
import WorkspaceAccessManager from "@/components/WorkspaceAccessManager";
import CopyLinkButton from "@/components/CopyLinkButton";
import ReprocessWorkspaceButton from "@/components/ReprocessWorkspaceButton";

export const dynamic = "force-dynamic";

interface WorkspacePageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrganizerWorkspacePage({ params }: WorkspacePageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role === "VIEWER") {
    redirect("/guest");
  }

  const { slug } = await params;
  const workspace = await getWorkspaceForUserBySlug({
    slug,
    userId: session.user.id,
    globalRole: session.user.role,
  });

  if (!workspace) {
    notFound();
  }

  const currentMembershipRole =
    workspace.members.find((member) => member.user.id === session.user.id)?.role ?? null;
  const canManageActiveWorkspace = canManageWorkspace({
    globalRole: session.user.role,
    ownerId: workspace.ownerId,
    userId: session.user.id,
    membershipRole: currentMembershipRole,
  });
  const canUploadActiveWorkspace = canUploadWorkspace({
    globalRole: session.user.role,
    ownerId: workspace.ownerId,
    userId: session.user.id,
    membershipRole: currentMembershipRole,
  });

  const [people, photos, reprocessPhotos, faceCount, noFaceCount, publicLink] = await Promise.all([
    prisma.person.findMany({
      where: { eventId: workspace.id },
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
      where: { eventId: workspace.id },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true,
        url: true,
        faceCount: true,
      },
    }),
    prisma.photo.findMany({
      where: { eventId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        url: true,
        analysisStatus: true,
      },
    }),
    prisma.face.count({
      where: {
        photo: {
          eventId: workspace.id,
        },
      },
    }),
    prisma.photo.count({
      where: {
        eventId: workspace.id,
        analysisStatus: "NO_FACE",
      },
    }),
    getOrCreateWorkspacePublicLink(workspace.id),
  ]);

  const personCards = people.map((person) => ({
    id: person.id,
    name: person.name,
    faceCount: person._count.faces,
    coverUrl: person.faces[0]?.photo.url ?? null,
  }));

  const workspaceAccessLabel = isAdmin(session.user.role)
    ? "System admin access"
    : currentMembershipRole
      ? formatWorkspaceRole(currentMembershipRole)
      : formatGlobalRole(session.user.role);

  return (
    <div className="page-shell py-6 sm:py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/organizer" className="action-secondary w-fit">
            <ArrowLeft className="h-4 w-4" />
            Back to control room
          </Link>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
            {workspaceAccessLabel}
          </div>
        </div>

        <section className="hero-surface p-6 sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="eyebrow-badge">
                <FolderKanban className="h-3.5 w-3.5" />
                Workspace overview
              </div>

              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                  {workspace.name}
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-[15px]">
                  {workspace.description ||
                    "Original uploads, strict verification, and one private camera-only guest link."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  Owner {workspace.owner.name || workspace.owner.email || "Unknown"}
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {workspace._count.members} members
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {workspace._count.invites} pending invites
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[300px]">
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
                path={getOrganizerWorkspacePath(workspace.slug)}
                label="Copy organizer link"
                copiedLabel="Organizer link copied"
                className="action-secondary"
              />
              {canManageActiveWorkspace && (
                <ResetButton workspaceId={workspace.id} workspaceName={workspace.name} />
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Photos", value: workspace._count.photos, icon: ImageIcon },
            { label: "Guest groups", value: workspace._count.people, icon: Users },
            { label: "Recognized faces", value: faceCount, icon: Camera },
            { label: "No-face uploads", value: noFaceCount, icon: FolderKanban },
          ].map((metric) => (
            <div key={metric.label} className="metric-card">
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
            <UploadForm workspaceId={workspace.id} workspaceName={workspace.name} />
          ) : (
            <div className="surface-card p-6 text-sm leading-6 text-slate-500">
              Upload access is limited to this workspace team.
            </div>
          )}

          {canManageActiveWorkspace ? (
            <WorkspaceAccessManager
              workspaceId={workspace.id}
              ownerId={workspace.ownerId}
              currentUserId={session.user.id}
              members={workspace.members.map((member) => ({
                userId: member.user.id,
                name: member.user.name,
                email: member.user.email,
                image: member.user.image,
                role: member.role,
              }))}
              invites={workspace.invites.map((invite) => ({
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
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            photos={reprocessPhotos}
          />
        )}

        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Guest groups</h2>
              <p className="mt-1 text-sm text-slate-500">Matched clusters inside {workspace.name}.</p>
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
                  workspaceId={workspace.id}
                  workspaceSlug={workspace.slug}
                  person={person}
                  canManage={canManageActiveWorkspace}
                />
              ))}
            </div>
          )}
        </section>

        <PhotoGrid photos={photos} />
      </div>
    </div>
  );
}
