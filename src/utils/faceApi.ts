import * as faceapi from "face-api.js";

const MODEL_SOURCES = ["/models"];
let loadingPromise: Promise<void> | null = null;

async function loadFromSource(modelUrl: string) {
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

export async function imageFromSource(source: Blob | string) {
  return typeof source === "string" ? faceapi.fetchImage(source) : faceapi.bufferToImage(source);
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

export async function getFullFaceDescription(source: Blob | string) {
  try {
    await ensureFaceModels();
    const image = await imageFromSource(source);
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
