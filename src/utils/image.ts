import loadImage from "blueimp-load-image";

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
