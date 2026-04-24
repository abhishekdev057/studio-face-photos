import { v2 as cloudinary } from "cloudinary";
import { ALLOWED_CLOUDINARY_FORMATS, MAX_IMAGE_UPLOAD_BYTES } from "@/lib/uploadSecurity";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function createSignedBrowserUpload(publicId: string) {
  const cloudName = getRequiredEnv("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const apiKey = getRequiredEnv("CLOUDINARY_API_KEY");
  getRequiredEnv("CLOUDINARY_API_SECRET");

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    {
      overwrite: "false",
      public_id: publicId,
      timestamp,
    },
    process.env.CLOUDINARY_API_SECRET as string,
  );

  return {
    apiKey,
    cloudName,
    publicId,
    signature,
    timestamp,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  };
}

type CloudinaryImageResource = {
  asset_id?: string;
  bytes?: number;
  format?: string;
  public_id?: string;
  resource_type?: string;
  secure_url?: string;
  width?: number;
  height?: number;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function getCloudinaryImageResource(publicId: string, attempts = 3) {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return (await cloudinary.api.resource(publicId, {
        resource_type: "image",
      })) as CloudinaryImageResource;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Cloudinary resource lookup failed.");
}

export async function destroyCloudinaryImage(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });
  } catch (error) {
    console.warn("Failed to destroy Cloudinary image", publicId, error);
  }
}

export function validateCloudinaryImageResource(resource: CloudinaryImageResource) {
  if (!resource.secure_url || resource.resource_type !== "image") {
    throw new Error("Uploaded asset is not a valid image.");
  }

  if (typeof resource.bytes !== "number" || resource.bytes <= 0) {
    throw new Error("Uploaded asset metadata is incomplete.");
  }

  if (resource.bytes > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image is too large. Keep uploads below 25MB.");
  }

  const format = (resource.format || "").toLowerCase();
  if (!ALLOWED_CLOUDINARY_FORMATS.has(format)) {
    throw new Error("Only JPEG, PNG, and WEBP images are supported.");
  }

  return {
    bytes: resource.bytes,
    format,
    height: resource.height ?? 0,
    secureUrl: resource.secure_url,
    width: resource.width ?? 0,
  };
}
