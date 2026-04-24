"use client";

export type UploadSessionResult =
  | {
      success: true;
      skipped?: boolean;
      upload?: {
        apiKey: string;
        cloudName: string;
        publicId: string;
        signature: string;
        timestamp: number;
        uploadUrl: string;
      };
    }
  | {
      success: false;
      error: string;
    };

export type FinalizeUploadResult =
  | {
      success: true;
      skipped?: boolean;
      warning?: string;
    }
  | {
      success: false;
      error: string;
    };

type CloudinaryUploadResponse = {
  error?: {
    message?: string;
  };
  public_id?: string;
  secure_url?: string;
};

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeFileSha256(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return bytesToHex(new Uint8Array(digest));
}

export async function createWorkspaceUploadSession({
  file,
  hash,
  workspaceId,
}: {
  file: File;
  hash: string;
  workspaceId: string;
}) {
  const response = await fetch("/api/workspaces/upload-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      hash,
      workspaceId,
    }),
  });

  const result = await readJsonResponse<UploadSessionResult>(response);
  if (!response.ok || !result) {
    throw new Error(result && "error" in result ? result.error : "Could not start upload.");
  }

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

export async function uploadFileDirectToCloudinary(
  file: File,
  upload: NonNullable<Exclude<UploadSessionResult, { success: false }>["upload"]>,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", upload.apiKey);
  formData.append("overwrite", "false");
  formData.append("public_id", upload.publicId);
  formData.append("signature", upload.signature);
  formData.append("timestamp", String(upload.timestamp));

  const response = await fetch(upload.uploadUrl, {
    method: "POST",
    body: formData,
  });

  const result = await readJsonResponse<CloudinaryUploadResponse>(response);
  if (!response.ok || !result?.public_id) {
    throw new Error(result?.error?.message || "Cloudinary upload failed.");
  }

  return result.public_id;
}

export async function finalizeWorkspaceUpload({
  hash,
  publicId,
  workspaceId,
}: {
  hash: string;
  publicId: string;
  workspaceId: string;
}) {
  const response = await fetch("/api/workspaces/register-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      hash,
      publicId,
      workspaceId,
    }),
  });

  const result = await readJsonResponse<FinalizeUploadResult>(response);
  if (!response.ok || !result) {
    throw new Error(result && "error" in result ? result.error : "Upload registration failed.");
  }

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}
