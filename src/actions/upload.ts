"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { getUploadWorkspaceById } from "@/lib/workspaces";
import { indexPhotoDescriptors, parseDescriptorPayload } from "@/lib/photoIndexing";
import { getSafeCloudinaryFormat, validateImageUpload } from "@/lib/uploadSecurity";
import { acquireWorkspaceFaceIndexLock } from "@/lib/workspaceMutationLock";
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
  analysisStatus?: "PROCESSED" | "NO_FACE" | "FAILED";
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
    const descriptors = parseDescriptorPayload(formData.get("descriptors"));

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

    let analysisStatus: UploadActionResult["analysisStatus"] = "FAILED";
    const detectedFaces = descriptors.length;
    let matchedPeople = 0;
    let warning: string | undefined;

    if (descriptors.length === 0) {
      analysisStatus = "NO_FACE";
    } else {
      try {
        const assignedPersonIds = await prisma.$transaction(async (tx) => {
          await acquireWorkspaceFaceIndexLock(tx, workspace.id);

          return indexPhotoDescriptors({
            tx,
            eventId: workspace.id,
            photoId: photo.id,
            descriptors,
          });
        });

        matchedPeople = assignedPersonIds.length;
        analysisStatus = "PROCESSED";
      } catch (error) {
        console.error("Upload analysis failed after original image was stored.", error);
        warning =
          error instanceof Error
            ? error.message
            : "Face analysis failed after the original image was uploaded.";
        analysisStatus = "FAILED";
      }
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        faceCount: detectedFaces,
        analysisStatus,
        analyzedAt: new Date(),
      },
    });

    revalidatePath("/organizer");
    revalidatePath("/w/[slug]", "page");

    return {
      success: true,
      warning,
      detectedFaces,
      analysisStatus,
      matchedPeople,
    } satisfies UploadActionResult;
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to upload photo",
    } satisfies UploadActionResult;
  }
}
