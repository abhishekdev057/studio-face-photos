"use server";

import { WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, slugifyWorkspaceName } from "@/lib/slug";
import { getManageableWorkspaceById, getOrganizerWorkspacePath, isOrganizer } from "@/lib/workspaces";

type WorkspaceActionResult = {
  success: boolean;
  error?: string;
  message?: string;
  workspaceSlug?: string;
};

const ASSIGNABLE_WORKSPACE_ROLES: WorkspaceRole[] = ["MANAGER", "CONTRIBUTOR"];

async function buildUniqueWorkspaceSlug(name: string) {
  const baseSlug = slugifyWorkspaceName(name) || "workspace";
  let candidate = baseSlug;
  let suffix = 2;

  while (
    await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export async function createWorkspace(name: string, description?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }
    if (!isOrganizer(session.user.role)) {
      throw new Error("Only organizers can create workspaces");
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      throw new Error("Workspace name must be at least 3 characters");
    }

    const slug = await buildUniqueWorkspaceSlug(trimmedName);
    await prisma.event.create({
      data: {
        name: trimmedName,
        slug,
        description: description?.trim() || null,
        ownerId: session.user.id,
        links: {
          create: {
            type: "ALL",
          },
        },
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    revalidatePath("/organizer");
    revalidatePath(getOrganizerWorkspacePath(slug));
    return { success: true, workspaceSlug: slug } satisfies WorkspaceActionResult;
  } catch (error) {
    console.error("Create workspace error:", error);
    return { success: false, error: "Failed to create workspace" } satisfies WorkspaceActionResult;
  }
}

export async function inviteWorkspaceMember(workspaceId: string, email: string, role: WorkspaceRole) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const workspace = await getManageableWorkspaceById({
      workspaceId,
      userId: session.user.id,
      globalRole: session.user.role,
    });
    if (!workspace) {
      throw new Error("Workspace not found or access denied");
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes("@")) {
      throw new Error("A valid email is required");
    }
    if (!ASSIGNABLE_WORKSPACE_ROLES.includes(role)) {
      throw new Error("Choose a valid organizer role");
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, role: true },
    });

    if (existingUser) {
      await prisma.$transaction([
        prisma.eventMember.upsert({
          where: {
            eventId_userId: {
              eventId: workspace.id,
              userId: existingUser.id,
            },
          },
          create: {
            eventId: workspace.id,
            userId: existingUser.id,
            role,
          },
          update: {
            role,
          },
        }),
        prisma.eventInvite.deleteMany({
          where: {
            eventId: workspace.id,
            email: normalizedEmail,
          },
        }),
        prisma.user.updateMany({
          where: {
            id: existingUser.id,
            role: "VIEWER",
          },
          data: {
            role: "ORGANIZER",
          },
        }),
      ]);

      revalidatePath("/organizer");
      revalidatePath(getOrganizerWorkspacePath(workspace.slug));
      return {
        success: true,
        message: "User was added to the workspace immediately.",
      } satisfies WorkspaceActionResult;
    }

    await prisma.eventInvite.upsert({
      where: {
        eventId_email: {
          eventId: workspace.id,
          email: normalizedEmail,
        },
      },
      create: {
        eventId: workspace.id,
        email: normalizedEmail,
        role,
        invitedById: session.user.id,
      },
      update: {
        role,
        invitedById: session.user.id,
        claimedAt: null,
        claimedById: null,
      },
    });

    revalidatePath("/organizer");
    revalidatePath(getOrganizerWorkspacePath(workspace.slug));
    return {
      success: true,
      message: "Invitation saved. Organizer access will activate as soon as that user signs in.",
    } satisfies WorkspaceActionResult;
  } catch (error) {
    console.error("Invite workspace member error:", error);
    return { success: false, error: "Failed to add workspace access" } satisfies WorkspaceActionResult;
  }
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const workspace = await getManageableWorkspaceById({
      workspaceId,
      userId: session.user.id,
      globalRole: session.user.role,
    });
    if (!workspace) {
      throw new Error("Workspace not found or access denied");
    }

    if (workspace.ownerId === userId) {
      throw new Error("The workspace owner cannot be removed");
    }

    await prisma.eventMember.deleteMany({
      where: {
        eventId: workspace.id,
        userId,
      },
    });

    revalidatePath("/organizer");
    revalidatePath(getOrganizerWorkspacePath(workspace.slug));
    return { success: true } satisfies WorkspaceActionResult;
  } catch (error) {
    console.error("Remove workspace member error:", error);
    return { success: false, error: "Failed to remove workspace member" } satisfies WorkspaceActionResult;
  }
}

export async function revokeWorkspaceInvite(workspaceId: string, inviteId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const workspace = await getManageableWorkspaceById({
      workspaceId,
      userId: session.user.id,
      globalRole: session.user.role,
    });
    if (!workspace) {
      throw new Error("Workspace not found or access denied");
    }

    await prisma.eventInvite.deleteMany({
      where: {
        id: inviteId,
        eventId: workspace.id,
      },
    });

    revalidatePath("/organizer");
    revalidatePath(getOrganizerWorkspacePath(workspace.slug));
    return { success: true } satisfies WorkspaceActionResult;
  } catch (error) {
    console.error("Revoke workspace invite error:", error);
    return { success: false, error: "Failed to revoke workspace invite" } satisfies WorkspaceActionResult;
  }
}
