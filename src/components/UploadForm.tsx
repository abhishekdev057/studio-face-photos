'use client';

import { useState, useEffect } from 'react';
import { uploadPhoto } from '@/actions/upload';
import * as faceapi from 'face-api.js';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

export default function UploadForm() {
    const [loading, setLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("");

    useEffect(() => {
        const loadModels = async () => {
            setStatus("Loading AI models...");
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelLoaded(true);
                setStatus("AI Models Ready");
            } catch (e) {
                setStatus("Error loading models");
            }
        };
        loadModels();
    }, []);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (!modelLoaded) return alert("Models not loaded yet");

        setLoading(true);
        const files = Array.from(e.target.files);

        let processed = 0;

        for (const file of files) {
            setStatus(`Processing ${file.name}...`);

            // Face detection
            // We need to create an image element
            const img = await faceapi.bufferToImage(file);
            const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

            const descriptors = detections.map(d => Array.from(d.descriptor));

            const formData = new FormData();
            formData.append("file", file);
            formData.append("descriptors", JSON.stringify(descriptors));

            await uploadPhoto(formData);
            processed++;
        }

        setLoading(false);
        setStatus(`Uploaded ${processed} photos successfully!`);
        setTimeout(() => setStatus(""), 3000);
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center">
                    {loading ? (
                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    ) : (
                        <Upload className="w-8 h-8 text-zinc-400" />
                    )}
                </div>

                <h3 className="text-xl font-bold text-white">Upload Wedding Photos</h3>
                <p className="text-zinc-500 text-center">
                    Select multiple photos. AI will automatically scan faces and group them.
                </p>

                {!modelLoaded && <p className="text-yellow-500 text-sm">Initializing AI...</p>}
                {status && <p className="text-cyan-400 text-sm">{status}</p>}

                <label className={`
          relative cursor-pointer bg-gradient-to-r from-cyan-600 to-blue-600 
          hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-full 
          transition-all shadow-lg hover:shadow-cyan-500/20
          ${loading || !modelLoaded ? 'opacity-50 pointer-events-none' : ''}
        `}>
                    <span>Select Photos</span>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={loading || !modelLoaded}
                    />
                </label>
            </div>
        </div>
    );
}
