"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getManageableWorkspaceById } from "@/lib/workspaces";
import { indexPhotoDescriptors, parseDescriptorPayload } from "@/lib/photoIndexing";

type ReprocessActionResult = {
  success: boolean;
  error?: string;
  photoCount?: number;
  detectedFaces?: number;
  analysisStatus?: "PROCESSED" | "NO_FACE" | "FAILED";
  matchedPeople?: number;
};

async function getReprocessWorkspace(workspaceId: string) {
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

  return workspace;
}

export async function beginWorkspaceReprocess(workspaceId: string) {
  try {
    const workspace = await getReprocessWorkspace(workspaceId);

    const photoCount = await prisma.photo.count({
      where: { eventId: workspace.id },
    });

    await prisma.$transaction([
      prisma.face.deleteMany({
        where: {
          photo: {
            eventId: workspace.id,
          },
        },
      }),
      prisma.person.deleteMany({
        where: {
          eventId: workspace.id,
        },
      }),
      prisma.photo.updateMany({
        where: { eventId: workspace.id },
        data: {
          faceCount: 0,
          analysisStatus: "QUEUED",
          analyzedAt: null,
        },
      }),
    ]);

    return { success: true, photoCount } satisfies ReprocessActionResult;
  } catch (error) {
    console.error("Begin workspace reprocess error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to start reprocessing",
    } satisfies ReprocessActionResult;
  }
}

export async function reprocessWorkspacePhoto({
  workspaceId,
  photoId,
  descriptors,
}: {
  workspaceId: string;
  photoId: string;
  descriptors: number[][];
}) {
  try {
    const workspace = await getReprocessWorkspace(workspaceId);
    const normalizedDescriptors = parseDescriptorPayload(descriptors);

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

    const detectedFaces = normalizedDescriptors.length;
    let matchedPeople = 0;
    let analysisStatus: ReprocessActionResult["analysisStatus"] = "NO_FACE";

    await prisma.$transaction(async (tx) => {
      await tx.face.deleteMany({
        where: { photoId },
      });

      if (normalizedDescriptors.length > 0) {
        const assignedPersonIds = await indexPhotoDescriptors({
          tx,
          eventId: workspace.id,
          photoId,
          descriptors: normalizedDescriptors,
        });

        matchedPeople = assignedPersonIds.length;
        analysisStatus = "PROCESSED";
      }

      await tx.photo.update({
        where: { id: photoId },
        data: {
          faceCount: detectedFaces,
          analysisStatus,
          analyzedAt: new Date(),
        },
      });

      await tx.person.deleteMany({
        where: {
          eventId: workspace.id,
          faces: {
            none: {},
          },
        },
      });
    });

    return {
      success: true,
      detectedFaces,
      analysisStatus,
      matchedPeople,
    } satisfies ReprocessActionResult;
  } catch (error) {
    console.error("Reprocess workspace photo error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reprocess photo",
      analysisStatus: "FAILED",
    } satisfies ReprocessActionResult;
  }
}

export async function markWorkspacePhotoReprocessFailed(workspaceId: string, photoId: string) {
  try {
    const workspace = await getReprocessWorkspace(workspaceId);

    await prisma.photo.updateMany({
      where: {
        id: photoId,
        eventId: workspace.id,
      },
      data: {
        faceCount: 0,
        analysisStatus: "FAILED",
        analyzedAt: new Date(),
      },
    });

    return { success: true, analysisStatus: "FAILED" } satisfies ReprocessActionResult;
  } catch (error) {
    console.error("Mark workspace photo failed error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark photo as failed",
      analysisStatus: "FAILED",
    } satisfies ReprocessActionResult;
  }
}

export async function finishWorkspaceReprocess(workspaceId: string) {
  try {
    await getReprocessWorkspace(workspaceId);

    revalidatePath("/organizer");
    revalidatePath("/w/[slug]", "page");
    return { success: true } satisfies ReprocessActionResult;
  } catch (error) {
    console.error("Finish workspace reprocess error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to finish reprocessing",
    } satisfies ReprocessActionResult;
  }
}
