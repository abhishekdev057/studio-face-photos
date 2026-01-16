'use client';

import { useState, useEffect } from 'react';
import { uploadPhoto } from '@/actions/upload';
import * as faceapi from 'face-api.js';
import { Upload, CheckCircle, Sparkles } from 'lucide-react';
import { resizeImage } from "@/utils/image";

export default function UploadForm() {
    const [loading, setLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });

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
        setProgress({ current: 0, total: files.length });

        let processed = 0;

        for (const file of files) {
            setStatus(`Optimizing ${file.name}...`);

            try {
                // Resize image to prevent memory crash on mobile & speed up
                const resizedBlob = await resizeImage(file, 1280);
                const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });

                setStatus(`Scanning faces in ${file.name}...`);

                // Face detection on resized image
                const img = await faceapi.bufferToImage(resizedBlob);
                const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

                const descriptors = detections.map(d => Array.from(d.descriptor));

                const formData = new FormData();
                formData.append("file", resizedFile); // Upload smaller file
                formData.append("descriptors", JSON.stringify(descriptors));

                setStatus(`Uploading ${file.name}...`);
                const res = await uploadPhoto(formData);
                processed++;

                if (!res.success) {
                    throw new Error(res.error);
                }

                setProgress({ current: processed, total: files.length });
            } catch (err) {
                console.error(`Error uploading ${file.name}`, err);
                setStatus(`Failed: ${file.name}`);
            }
        }

        setLoading(false);
        setStatus(`Done! Evaluated ${processed} photos.`);

        setTimeout(() => setStatus(""), 4000);
        setTimeout(() => setProgress({ current: 0, total: 0 }), 4000);
    };

    return (
        <div className="w-full glass-panel p-8 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl">
            <div className="flex flex-col items-center justify-center space-y-6">

                {/* Upload Icon Circle */}
                <div className="relative">
                    <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center relative border border-zinc-700 overflow-hidden">
                        {loading ? (
                            <div className="absolute inset-0 rounded-full border-4 border-zinc-900 border-t-cyan-500 animate-spin" />
                        ) : (
                            <Upload className="w-8 h-8 text-zinc-400" />
                        )}
                        <div className="absolute inset-0 bg-cyan-500/10 animate-pulse rounded-full blur-xl" />
                    </div>
                    {modelLoaded && !loading && (
                        <div className="absolute -bottom-2 -right-2 bg-green-500 text-black text-[10px] p-1 rounded-full border-2 border-zinc-900">
                            <CheckCircle className="w-4 h-4 fill-white text-green-600" />
                        </div>
                    )}
                </div>

                <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
                        Upload Photos
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                    </h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto">
                        Select multiple photos. We'll automatically resize, scan, and organize them by face.
                    </p>
                </div>

                {/* Status & Progress Bar */}
                {(status || loading) && (
                    <div className="w-full space-y-3 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/50">
                        <div className="flex justify-between text-xs font-mono">
                            <span className="text-cyan-400 animate-pulse">{status}</span>
                            <span className="text-zinc-500">{progress.current} / {progress.total}</span>
                        </div>

                        {loading && (
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out relative"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-[scan_1s_linear_infinite]" />
                                </div>
                            </div>
                        )}
                    </div>
                )}


                <label className={`
                    w-full group relative cursor-pointer
                    ${loading || !modelLoaded ? 'opacity-50 pointer-events-none' : ''}
                `}>
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                    <div className="relative flex items-center justify-center gap-3 bg-zinc-900 ring-1 ring-white/10 rounded-xl px-8 py-4 leading-none text-white transition-all hover:bg-zinc-800 font-semibold shadow-2xl">
                        <span>{loading ? "Processing..." : "Select Photos"}</span>
                    </div>

                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={loading || !modelLoaded}
                    />
                </label>

                {!modelLoaded && <p className="text-zinc-600 text-xs animate-pulse">Initializing neural networks...</p>}
            </div>
        </div>
    );
}

