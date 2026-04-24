import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  destroyCloudinaryImage,
  getCloudinaryImageResource,
  validateCloudinaryImageResource,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { getOrganizerWorkspacePath, getUploadWorkspaceById } from "@/lib/workspaces";

export const runtime = "nodejs";

type RegisterUploadRequest = {
  hash?: string;
  publicId?: string;
  workspaceId?: string;
};

export async function POST(request: Request) {
  let publicIdToCleanup: string | null = null;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as RegisterUploadRequest;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const hash = typeof body.hash === "string" ? body.hash : "";
    const publicId = typeof body.publicId === "string" ? body.publicId : "";
    publicIdToCleanup = publicId || null;

    if (!workspaceId || !hash || !publicId) {
      return NextResponse.json(
        { success: false, error: "Upload registration payload is incomplete." },
        { status: 400 },
      );
    }

    const workspace = await getUploadWorkspaceById({
      workspaceId,
      userId: session.user.id,
      globalRole: session.user.role,
    });

    if (!workspace) {
      return NextResponse.json(
        { success: false, error: "Workspace not found or access denied." },
        { status: 404 },
      );
    }

    if (!publicId.startsWith(`face-organizer/${workspace.slug}/`)) {
      return NextResponse.json(
        { success: false, error: "Upload destination is invalid for this workspace." },
        { status: 400 },
      );
    }

    const existingPhoto = await prisma.photo.findFirst({
      where: {
        eventId: workspace.id,
        hash,
      },
      select: { id: true },
    });

    if (existingPhoto) {
      await destroyCloudinaryImage(publicId);
      return NextResponse.json({ success: true, skipped: true });
    }

    const resource = await getCloudinaryImageResource(publicId);
    const validatedResource = validateCloudinaryImageResource(resource);

    const photo = await prisma.photo.create({
      data: {
        url: validatedResource.secureUrl,
        width: validatedResource.width,
        height: validatedResource.height,
        eventId: workspace.id,
        uploadedById: session.user.id,
        hash,
        faceCount: 0,
        analysisStatus: "QUEUED",
      },
    });

    revalidatePath("/organizer");
    revalidatePath(getOrganizerWorkspacePath(workspace.slug));
    revalidatePath("/w/[slug]", "page");

    return NextResponse.json({
      success: true,
      analysisStatus: photo.analysisStatus,
      detectedFaces: 0,
      matchedPeople: 0,
      warning: `Stored original image. Run Process images in ${workspace.name} when the upload batch is ready.`,
    });
  } catch (error) {
    if (publicIdToCleanup) {
      await destroyCloudinaryImage(publicIdToCleanup);
    }

    console.error("Upload registration API failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to register upload.",
      },
      { status: 500 },
    );
  }
}
