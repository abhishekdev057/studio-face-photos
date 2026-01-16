import * as faceapi from 'face-api.js';

export const loadModels = async () => {
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
    } catch (error) {
        console.error("Failed to load models", error);
        throw error;
    }
};

export const getFullFaceDescription = async (blob: Blob) => {
    const img = await faceapi.bufferToImage(blob);
    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
    return detections;
};
