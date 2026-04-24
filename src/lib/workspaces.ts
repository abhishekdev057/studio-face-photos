import { Role, WorkspaceRole, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MANAGE_ROLES: WorkspaceRole[] = ["OWNER", "MANAGER"];
const CONTRIBUTOR_ROLES: WorkspaceRole[] = ["OWNER", "MANAGER", "CONTRIBUTOR"];

export function isAdmin(role: Role | undefined) {
  return role === "ADMIN";
}

export function isOrganizer(role: Role | undefined) {
  return role === "ADMIN" || role === "ORGANIZER";
}

export function formatWorkspaceRole(role: WorkspaceRole | string) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function formatGlobalRole(role: Role | undefined) {
  if (role === "ADMIN") {
    return "System admin";
  }

  if (role === "ORGANIZER") {
    return "Organizer";
  }

  return "Viewer";
}

export function getOrganizerWorkspacePath(slug: string) {
  return `/organizer/workspace/${encodeURIComponent(slug)}`;
}

export function getOrganizerPersonPath(workspaceSlug: string, personId: string) {
  return `${getOrganizerWorkspacePath(workspaceSlug)}/person/${encodeURIComponent(personId)}`;
}

export function canManageWorkspaceRole(role: WorkspaceRole | null | undefined) {
  return !!role && MANAGE_ROLES.includes(role);
}

export function canContributeWorkspaceRole(role: WorkspaceRole | null | undefined) {
  return !!role && CONTRIBUTOR_ROLES.includes(role);
}

export function canManageWorkspace({
  globalRole,
  ownerId,
  userId,
  membershipRole,
}: {
  globalRole?: Role;
  ownerId: string;
  userId: string;
  membershipRole?: WorkspaceRole | null;
}) {
  return isAdmin(globalRole) || ownerId === userId || canManageWorkspaceRole(membershipRole);
}

export function canUploadWorkspace({
  globalRole,
  ownerId,
  userId,
  membershipRole,
}: {
  globalRole?: Role;
  ownerId: string;
  userId: string;
  membershipRole?: WorkspaceRole | null;
}) {
  return isAdmin(globalRole) || ownerId === userId || canContributeWorkspaceRole(membershipRole);
}

export type WorkspaceListItem = Prisma.EventGetPayload<{
  include: {
    owner: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    members: {
      where: {
        userId: string;
      };
      select: {
        role: true;
      };
    };
    _count: {
      select: {
        photos: true;
        people: true;
        members: true;
        invites: true;
      };
    };
  };
}>;

export async function getAccessibleWorkspaces(userId: string, globalRole?: Role) {
  return prisma.event.findMany({
    where: isAdmin(globalRole)
      ? undefined
      : {
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        where: { userId },
        select: { role: true },
      },
      _count: {
        select: {
          photos: true,
          people: true,
          members: true,
          invites: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function getWorkspaceForUserBySlug({
  slug,
  userId,
  globalRole,
}: {
  slug: string;
  userId: string;
  globalRole?: Role;
}) {
  return prisma.event.findFirst({
    where: isAdmin(globalRole)
      ? { slug }
      : {
          slug,
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      },
      invites: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          photos: true,
          people: true,
          members: true,
          invites: true,
        },
      },
    },
  });
}

export async function getManageableWorkspaceById({
  workspaceId,
  userId,
  globalRole,
}: {
  workspaceId: string;
  userId: string;
  globalRole?: Role;
}) {
  const workspace = await prisma.event.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const membershipRole = workspace.members[0]?.role;
  if (
    !canManageWorkspace({
      globalRole,
      ownerId: workspace.ownerId,
      userId,
      membershipRole,
    })
  ) {
    return null;
  }

  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    ownerId: workspace.ownerId,
    membershipRole,
  };
}

export async function getUploadWorkspaceById({
  workspaceId,
  userId,
  globalRole,
}: {
  workspaceId: string;
  userId: string;
  globalRole?: Role;
}) {
  const workspace = await prisma.event.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      slug: true,
      name: true,
      ownerId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const membershipRole = workspace.members[0]?.role;
  if (
    !canUploadWorkspace({
      globalRole,
      ownerId: workspace.ownerId,
      userId,
      membershipRole,
    })
  ) {
    return null;
  }

  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    ownerId: workspace.ownerId,
    membershipRole,
  };
}

export async function getWorkspaceByPublicSlug(slug: string) {
  const shareLink = await prisma.shareLink.findUnique({
    where: { slug },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          owner: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              photos: true,
              people: true,
            },
          },
        },
      },
    },
  });

  if (!shareLink) {
    return null;
  }

  return {
    shareLinkId: shareLink.id,
    shareSlug: shareLink.slug,
    ...shareLink.event,
  };
}

export async function getOrCreateWorkspacePublicLink(eventId: string) {
  const existingLink = await prisma.shareLink.findFirst({
    where: {
      eventId,
      type: "ALL",
    },
    select: {
      id: true,
      slug: true,
      views: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingLink) {
    return existingLink;
  }

  return prisma.shareLink.create({
    data: {
      eventId,
      type: "ALL",
    },
    select: {
      id: true,
      slug: true,
      views: true,
    },
  });
}

export async function recordWorkspacePublicView(shareSlug: string) {
  return prisma.shareLink.updateMany({
    where: { slug: shareSlug },
    data: {
      views: {
        increment: 1,
      },
    },
  });
}
