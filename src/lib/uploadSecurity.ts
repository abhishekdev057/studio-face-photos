const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;

function matchesJpegSignature(buffer: Uint8Array) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function matchesPngSignature(buffer: Uint8Array) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function matchesWebpSignature(buffer: Uint8Array) {
  return (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

export function validateImageUpload(file: File, bytes: Uint8Array) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Only JPEG, PNG, and WEBP images are supported.");
  }

  if (bytes.byteLength === 0) {
    throw new Error("Uploaded image is empty.");
  }

  if (bytes.byteLength > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image is too large. Keep uploads below 25MB.");
  }

  const hasValidSignature =
    matchesJpegSignature(bytes) || matchesPngSignature(bytes) || matchesWebpSignature(bytes);
  if (!hasValidSignature) {
    throw new Error("Image signature validation failed.");
  }
}

export function getSafeCloudinaryFormat(file: File) {
  switch (file.type) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}
