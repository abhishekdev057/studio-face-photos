'use client';

import { useState, useEffect } from 'react';
import { uploadPhoto } from '@/actions/upload';
import * as faceapi from 'face-api.js';
import { Upload, Loader2, CheckCircle } from 'lucide-react';

export default function UploadForm() {
    const [loading, setLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("");
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [duplicates, setDuplicates] = useState(0);

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
        setDuplicates(0);
        const files = Array.from(e.target.files);
        setProgress({ current: 0, total: files.length });

        let processed = 0;
        let dupeCount = 0;

        for (const file of files) {
            setStatus(`Scanning faces in ${file.name}...`);

            try {
                // Face detection
                const img = await faceapi.bufferToImage(file);
                const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

                const descriptors = detections.map(d => Array.from(d.descriptor));

                const formData = new FormData();
                formData.append("file", file);
                formData.append("descriptors", JSON.stringify(descriptors));

                setStatus(`Uploading ${file.name}...`);
                const res = await uploadPhoto(formData);
                processed++;

                if (res.duplicate) {
                    dupeCount++;
                    setDuplicates(dupeCount);
                }

                setProgress({ current: processed, total: files.length });
            } catch (err) {
                console.error(`Error uploading ${file.name}`, err);
            }
        }

        setLoading(false);
        setStatus(`Done! Evaluated ${processed} photos.`);

        // Don't clear status immediately if there are duplicates to show
        if (dupeCount === 0) {
            setTimeout(() => setStatus(""), 4000);
            setTimeout(() => setProgress({ current: 0, total: 0 }), 4000);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl">
            <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center relative">
                    {loading ? (
                        <div className="absolute inset-0 rounded-full border-4 border-zinc-700 border-t-cyan-400 animate-spin" />
                    ) : (
                        <Upload className="w-8 h-8 text-zinc-400" />
                    )}
                </div>

                <h3 className="text-xl font-bold text-white">Upload Wedding Photos</h3>
                <p className="text-zinc-500 text-center">
                    Select multiple photos. AI will automatically scan faces and group them.
                </p>

                {!modelLoaded && <p className="text-yellow-500 text-sm">Initializing AI...</p>}

                {/* Status & Progress Bar */}
                {status && (
                    <div className="w-full space-y-2">
                        <div className="flex justify-between text-xs text-cyan-400 font-mono">
                            <span>{status}</span>
                            <div className="flex gap-2">
                                {duplicates > 0 && <span className="text-yellow-500 font-bold">{duplicates} Duplicate(s)</span>}
                                {loading && <span>{progress.current} / {progress.total}</span>}
                            </div>
                        </div>
                        {loading && (
                            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-cyan-500 transition-all duration-300 ease-out"
                                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                />
                            </div>
                        )}
                        {!loading && duplicates > 0 && (
                            <div className="border border-yellow-500/20 bg-yellow-500/10 p-2 rounded text-xs text-yellow-200 text-center mt-2">
                                warning: {duplicates} identical photos were skipped.
                            </div>
                        )}
                    </div>
                )}


                <label className={`
          relative cursor-pointer bg-gradient-to-r from-cyan-600 to-blue-600 
          hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-8 rounded-full 
          transition-all shadow-lg hover:shadow-cyan-500/20
          ${loading || !modelLoaded ? 'opacity-50 pointer-events-none' : ''}
        `}>
                    <span>{loading ? "Processing..." : "Select Photos"}</span>
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

