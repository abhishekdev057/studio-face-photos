const MODEL_SOURCES = ["/models"];
let loadingPromise: Promise<void> | null = null;
let faceApiModulePromise: Promise<typeof import("@vladmandic/face-api/dist/face-api.esm.js")> | null =
  null;

async function getFaceApi() {
  if (typeof window === "undefined") {
    throw new Error("Face engine is only available in the browser.");
  }

  if (!faceApiModulePromise) {
    faceApiModulePromise = import("@vladmandic/face-api/dist/face-api.esm.js");
  }

  return faceApiModulePromise;
}

async function loadFromSource(modelUrl: string) {
  const faceapi = await getFaceApi();
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
  ]);
}

export async function ensureFaceModels() {
  if (!loadingPromise) {
    loadingPromise = (async () => {
      let lastError: unknown;

      for (const modelUrl of MODEL_SOURCES) {
        try {
          await loadFromSource(modelUrl);
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("Unable to load face recognition models.");
    })();
  }

  return loadingPromise;
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image for face analysis."));

    if (!source.startsWith("data:") && !source.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }

    image.src = source;
  });
}

export async function imageFromSource(source: Blob | string) {
  const faceapi = await getFaceApi();

  if (typeof source !== "string") {
    return faceapi.bufferToImage(source);
  }

  if (source.startsWith("data:") || source.startsWith("blob:")) {
    return loadImageElement(source);
  }

  return faceapi.fetchImage(source);
}

function buildAnalysisSurface(
  image: HTMLImageElement | HTMLCanvasElement,
  maxDimension?: number,
) {
  if (!maxDimension || maxDimension <= 0) {
    return image;
  }

  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const largestDimension = Math.max(sourceWidth, sourceHeight);

  if (!largestDimension || largestDimension <= maxDimension) {
    return image;
  }

  const scale = maxDimension / largestDimension;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return image;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvas;
}

type DetectionLike = {
  detection: {
    score?: number;
    box: {
      width: number;
      height: number;
      area: number;
    };
  };
};

type DetectionFilterOptions = {
  imageWidth: number;
  imageHeight: number;
  minScore?: number;
  minAbsoluteFaceSize?: number;
  minRelativeFaceSize?: number;
};

export function filterReliableDetections<T extends DetectionLike>(
  detections: T[],
  {
    imageWidth,
    imageHeight,
    minScore = 0.7,
    minAbsoluteFaceSize = 48,
    minRelativeFaceSize = 0.045,
  }: DetectionFilterOptions,
) {
  const minDimension = Math.min(imageWidth, imageHeight);
  const minFaceSize = Math.max(minAbsoluteFaceSize, minDimension * minRelativeFaceSize);

  return detections.filter((detection) => {
    const score = detection.detection.score ?? 1;
    const { width, height } = detection.detection.box;
    const shortestSide = Math.min(width, height);

    return score >= minScore && shortestSide >= minFaceSize;
  });
}

export async function getFullFaceDescription(
  source: Blob | string,
  options?: {
    maxDimension?: number;
  },
) {
  try {
    await ensureFaceModels();
    const faceapi = await getFaceApi();
    const rawImage = await imageFromSource(source);
    const image = buildAnalysisSurface(rawImage, options?.maxDimension);
    const detections = await faceapi
      .detectAllFaces(image)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return { image, detections };
  } catch (error) {
    console.error("Failed to analyze faces", error);
    throw error;
  }
}
