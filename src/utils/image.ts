import loadImage from "blueimp-load-image";
import { CLOUDINARY_BROWSER_UPLOAD_LIMIT_BYTES } from "@/lib/uploadSecurity";

const SAFE_BROWSER_UPLOAD_TARGET_BYTES = Math.floor(9.5 * 1024 * 1024);

export const resizeImage = (file: File, maxDimension: number = 1280): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    loadImage(
      file,
      (canvas) => {
        if (canvas instanceof HTMLCanvasElement) {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error("Canvas to Blob failed"));
              }
            },
            "image/jpeg",
            0.85,
          );
        } else {
          reject(new Error("Image loading failed"));
        }
      },
      {
        maxWidth: maxDimension,
        maxHeight: maxDimension,
        canvas: true,
        orientation: true,
      },
    );
  });
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Canvas to Blob failed"));
      },
      type,
      quality,
    );
  });
}

function loadCanvasFromFile(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    loadImage(
      file,
      (canvas) => {
        if (canvas instanceof HTMLCanvasElement) {
          resolve(canvas);
        } else {
          reject(new Error("Image loading failed"));
        }
      },
      {
        canvas: true,
        orientation: true,
      },
    );
  });
}

function drawResizedCanvas(source: HTMLCanvasElement, maxDimension: number) {
  const currentMaxDimension = Math.max(source.width, source.height);
  if (currentMaxDimension <= maxDimension) {
    return source;
  }

  const scale = maxDimension / currentMaxDimension;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not available");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  return canvas;
}

function getUploadTargetType(file: File) {
  if (file.type === "image/png" || file.type === "image/webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function getUploadQualities(type: string) {
  if (type === "image/webp") {
    return [0.92, 0.88, 0.84, 0.8, 0.76, 0.72];
  }

  return [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68];
}

function getDimensionSteps(source: HTMLCanvasElement) {
  const maxDimension = Math.max(source.width, source.height);
  const candidates = [maxDimension, 5200, 4800, 4400, 4000, 3600, 3200, 2800, 2400, 2000];
  return Array.from(
    new Set(
      candidates
        .filter((dimension) => dimension > 0 && dimension <= maxDimension)
        .sort((left, right) => right - left),
    ),
  );
}

function getPreparedFileName(file: File, targetType: string) {
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const extension = targetType === "image/webp" ? "webp" : "jpg";
  return `${baseName}.${extension}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type PreparedUploadFile = {
  file: File;
  optimized: boolean;
  originalSize: number;
  uploadSize: number;
  summary?: string;
};

export async function prepareImageForUpload(file: File): Promise<PreparedUploadFile> {
  if (file.size <= CLOUDINARY_BROWSER_UPLOAD_LIMIT_BYTES) {
    return {
      file,
      optimized: false,
      originalSize: file.size,
      uploadSize: file.size,
    };
  }

  const sourceCanvas = await loadCanvasFromFile(file);
  const targetType = getUploadTargetType(file);
  const qualities = getUploadQualities(targetType);
  const dimensionSteps = getDimensionSteps(sourceCanvas);
  let smallestBlob: { blob: Blob; dimension: number } | null = null;

  for (const dimension of dimensionSteps) {
    const resizedCanvas = drawResizedCanvas(sourceCanvas, dimension);

    for (const quality of qualities) {
      const blob = await canvasToBlob(resizedCanvas, targetType, quality);
      if (!smallestBlob || blob.size < smallestBlob.blob.size) {
        smallestBlob = { blob, dimension };
      }

      if (blob.size <= SAFE_BROWSER_UPLOAD_TARGET_BYTES) {
        return {
          file: new File([blob], getPreparedFileName(file, targetType), {
            type: targetType,
            lastModified: file.lastModified,
          }),
          optimized: true,
          originalSize: file.size,
          uploadSize: blob.size,
          summary: `${formatBytes(file.size)} -> ${formatBytes(blob.size)} • ${dimension}px`,
        };
      }
    }
  }

  if (smallestBlob && smallestBlob.blob.size <= CLOUDINARY_BROWSER_UPLOAD_LIMIT_BYTES) {
    return {
      file: new File([smallestBlob.blob], getPreparedFileName(file, targetType), {
        type: targetType,
        lastModified: file.lastModified,
      }),
      optimized: true,
      originalSize: file.size,
      uploadSize: smallestBlob.blob.size,
      summary: `${formatBytes(file.size)} -> ${formatBytes(smallestBlob.blob.size)} • ${smallestBlob.dimension}px`,
    };
  }

  throw new Error(
    "This image is still too large after optimization. Please reduce it below 10MB or upgrade Cloudinary.",
  );
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image loading failed"));
    image.src = source;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildSquareVariant(
  image: HTMLImageElement,
  {
    widthRatio,
    verticalBias = 0,
    filter = "none",
    quality = 0.94,
  }: {
    widthRatio: number;
    verticalBias?: number;
    filter?: string;
    quality?: number;
  },
) {
  const cropSize = Math.round(Math.min(image.width * widthRatio, image.height * 0.95));
  const cropX = Math.round((image.width - cropSize) / 2);
  const centeredY = (image.height - cropSize) / 2;
  const cropY = Math.round(
    clamp(centeredY + cropSize * verticalBias, 0, Math.max(image.height - cropSize, 0)),
  );

  const canvas = document.createElement("canvas");
  const outputSize = Math.min(Math.max(cropSize, 720), 1080);
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas not available");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = filter;
  context.drawImage(image, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);

  return canvas.toDataURL("image/jpeg", quality);
}

export async function createCameraSearchVariants(source: string) {
  const image = await loadImageElement(source);

  return [
    source,
    buildSquareVariant(image, { widthRatio: 0.84, verticalBias: -0.02, quality: 0.95 }),
    buildSquareVariant(image, { widthRatio: 0.72, verticalBias: -0.05 }),
    buildSquareVariant(image, {
      widthRatio: 0.72,
      verticalBias: 0.04,
      filter: "brightness(1.08) contrast(1.06)",
      quality: 0.95,
    }),
    buildSquareVariant(image, {
      widthRatio: 0.6,
      verticalBias: -0.1,
      filter: "brightness(1.12) contrast(1.08) saturate(1.04)",
      quality: 0.96,
    }),
  ];
}
