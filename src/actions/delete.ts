"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getManageableWorkspaceById } from "@/lib/workspaces";
import { revalidatePath } from "next/cache";

async function cleanupWorkspaceArtifacts(workspaceId: string) {
  await prisma.person.deleteMany({
    where: {
      eventId: workspaceId,
      faces: {
        none: {},
      },
    },
  });
}

export async function deletePerson(personId: string, workspaceId: string) {
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

    const person = await prisma.person.findFirst({
      where: {
        id: personId,
        eventId: workspace.id,
      },
      select: { id: true },
    });
    if (!person) {
      throw new Error("Person not found");
    }

    const faces = await prisma.face.findMany({
      where: { personId },
      select: { photoId: true },
    });
    const photoIdsToCheck = Array.from(new Set(faces.map((face) => face.photoId)));

    await prisma.$transaction([
      prisma.face.deleteMany({
        where: { personId },
      }),
      prisma.person.delete({
        where: { id: personId },
      }),
    ]);

    for (const photoId of photoIdsToCheck) {
      const remainingFaces = await prisma.face.count({
        where: { photoId },
      });

      if (remainingFaces === 0) {
        await prisma.photo.delete({
          where: { id: photoId },
        });
      }
    }

    await cleanupWorkspaceArtifacts(workspace.id);

    revalidatePath("/organizer");
    revalidatePath("/w/[slug]", "page");
    return { success: true };
  } catch (error) {
    console.error("Delete Person Error:", error);
    return { success: false, error: "Failed to delete person" };
  }
}

export async function deletePhoto(photoId: string, workspaceId: string) {
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

    const photo = await prisma.photo.findFirst({
      where: {
        id: photoId,
        eventId: workspace.id,
      },
      select: { id: true },
    });
    if (!photo) {
      throw new Error("Photo not found");
    }

    await prisma.photo.delete({
      where: { id: photoId },
    });

    await cleanupWorkspaceArtifacts(workspace.id);

    revalidatePath("/organizer");
    revalidatePath("/w/[slug]", "page");
    return { success: true };
  } catch (error) {
    console.error("Delete Photo Error:", error);
    return { success: false, error: "Failed to delete photo" };
  }
}
