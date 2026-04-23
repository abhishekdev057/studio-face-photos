"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getManageableWorkspaceById } from "@/lib/workspaces";
import { revalidatePath } from "next/cache";

export async function resetWorkspaceData(workspaceId: string) {
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

    await prisma.$transaction([
      prisma.photo.deleteMany({
        where: { eventId: workspace.id },
      }),
      prisma.person.deleteMany({
        where: { eventId: workspace.id },
      }),
    ]);

    revalidatePath("/organizer");
    revalidatePath("/w/[slug]", "page");
    return { success: true };
  } catch (error) {
    console.error("Reset Error:", error);
    return { success: false, error: "Failed to reset data" };
  }
}
