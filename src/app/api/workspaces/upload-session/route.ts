import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createSignedBrowserUpload } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { isAllowedImageMimeType, MAX_IMAGE_UPLOAD_BYTES } from "@/lib/uploadSecurity";
import { getUploadWorkspaceById } from "@/lib/workspaces";

export const runtime = "nodejs";

type UploadSessionRequest = {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  hash?: string;
  workspaceId?: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UploadSessionRequest;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
    const hash = typeof body.hash === "string" ? body.hash : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "Workspace is required." }, { status: 400 });
    }

    if (!hash) {
      return NextResponse.json({ success: false, error: "File hash is required." }, { status: 400 });
    }

    if (!isAllowedImageMimeType(fileType)) {
      return NextResponse.json(
        { success: false, error: "Only JPEG, PNG, and WEBP images are supported." },
        { status: 400 },
      );
    }

    if (fileSize <= 0 || fileSize > MAX_IMAGE_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "Image is too large. Keep uploads below 25MB." },
        { status: 413 },
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

    const existingPhoto = await prisma.photo.findFirst({
      where: {
        eventId: workspace.id,
        hash,
      },
      select: { id: true },
    });

    if (existingPhoto) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const publicId = `face-organizer/${workspace.slug}/${crypto.randomUUID()}`;
    const upload = createSignedBrowserUpload(publicId);

    return NextResponse.json({
      success: true,
      upload,
    });
  } catch (error) {
    console.error("Upload session API failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not start upload.",
      },
      { status: 500 },
    );
  }
}
