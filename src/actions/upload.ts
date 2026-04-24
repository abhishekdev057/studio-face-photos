"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { getOrganizerWorkspacePath, getUploadWorkspaceById } from "@/lib/workspaces";
import { getSafeCloudinaryFormat, validateImageUpload } from "@/lib/uploadSecurity";
import { auth } from "@/auth";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type UploadActionResult = {
  success: boolean;
  skipped?: boolean;
  error?: string;
  warning?: string;
  detectedFaces?: number;
  analysisStatus?: "QUEUED" | "PROCESSED" | "NO_FACE" | "FAILED";
  matchedPeople?: number;
};

type CloudinaryUploadResult = {
  secure_url: string;
  width?: number;
  height?: number;
};

function uploadImageBufferToCloudinary(
  buffer: Buffer,
  {
    folder,
    format,
    publicId,
  }: {
    folder: string;
    format: string;
    publicId: string;
  },
) {
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        public_id: publicId,
        format,
        unique_filename: true,
        use_filename: false,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          width: result.width,
          height: result.height,
        });
      },
    );

    stream.end(buffer);
  });
}

export async function uploadPhoto(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized");
    }

    const workspaceId = formData.get("workspaceId");
    if (typeof workspaceId !== "string" || workspaceId.length === 0) {
      throw new Error("Workspace is required");
    }

    const workspace = await getUploadWorkspaceById({
      workspaceId,
      userId: session.user.id,
      globalRole: session.user.role,
    });
    if (!workspace) {
      throw new Error("Workspace not found or access denied");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("No file");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    validateImageUpload(file, buffer);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const existingPhoto = await prisma.photo.findFirst({
      where: {
        eventId: workspace.id,
        hash,
      },
      select: { id: true },
    });

    if (existingPhoto) {
      return { success: true, skipped: true } satisfies UploadActionResult;
    }

    const uploadResult = await uploadImageBufferToCloudinary(buffer, {
      folder: `face-organizer/${workspace.slug}`,
      publicId: crypto.randomUUID(),
      format: getSafeCloudinaryFormat(file),
    });

    const photo = await prisma.photo.create({
      data: {
        url: uploadResult.secure_url,
        width: uploadResult.width ?? 0,
        height: uploadResult.height ?? 0,
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

    return {
      success: true,
      warning: `Stored original image. Run Process images in ${workspace.name} when the upload batch is ready.`,
      detectedFaces: 0,
      analysisStatus: photo.analysisStatus,
      matchedPeople: 0,
    } satisfies UploadActionResult;
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload photo",
    } satisfies UploadActionResult;
  }
}
