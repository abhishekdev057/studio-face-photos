'use client';

import { useState, useEffect, useRef } from 'react';
import { uploadPhoto } from '@/actions/upload';
import * as faceapi from 'face-api.js';
import { Upload, CheckCircle, Sparkles } from 'lucide-react';
import { resizeImage } from "@/utils/image";

export default function UploadForm() {
    const [isUploading, setIsUploading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("Initializing...");
    const [stats, setStats] = useState({
        total: 0,
        processed: 0,
        uploaded: 0,
        skipped: 0,
        errors: 0,
        pending: 0
    });
    const [logs, setLogs] = useState<string[]>([]);

    // Queue Refs to avoid re-renders for tens of thousands of items
    const queueRef = useRef<File[]>([]);
    const processingRef = useRef(false);
    const stopRef = useRef(false);

    // Persistence key
    const HISTORY_KEY = "aura_upload_history_v1";

    // Load Models
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
                setStatus("Error loading models. Please refresh.");
                console.error(e);
            }
        };
        loadModels();
    }, []);

    const addLog = (msg: string) => {
        setLogs(prev => [msg, ...prev].slice(0, 5)); // Keep last 5 logs
        setStatus(msg);
    };

    const generateFileId = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;

    const getHistory = (): Set<string> => {
        try {
            const item = localStorage.getItem(HISTORY_KEY);
            return item ? new Set(JSON.parse(item)) : new Set();
        } catch {
            return new Set();
        }
    };

    const addToHistory = (id: string) => {
        const history = getHistory();
        history.add(id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(Array.from(history)));
    };

    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        if (!modelLoaded) return alert("Models not loaded yet");

        const newFiles = Array.from(e.target.files);
        stopRef.current = false;

        // 1. Deduplicate against history
        const history = getHistory();
        const pendingFiles = [];
        let skippedCount = 0;

        for (const file of newFiles) {
            if (history.has(generateFileId(file))) {
                skippedCount++;
            } else {
                pendingFiles.push(file);
            }
        }

        // 2. Add to Queue
        queueRef.current = [...queueRef.current, ...pendingFiles];

        setStats(prev => ({
            ...prev,
            total: prev.total + newFiles.length,
            skipped: prev.skipped + skippedCount,
            pending: queueRef.current.length
        }));

        addLog(`Added ${newFiles.length} files. ${skippedCount} skipped (already uploaded).`);

        // 3. Start Pipeline
        if (!isUploading) {
            processQueue();
        }
    };

    const processQueue = async () => {
        if (processingRef.current || queueRef.current.length === 0) return;

        processingRef.current = true;
        setIsUploading(true);
        addLog("Starting upload pipeline...");

        // PIPELINE CONFIG
        const MAX_CPU_CONCURRENCY = 1; // Face API is heavy, keep to 1 to avoid freezing UI
        const MAX_NET_CONCURRENCY = 3; // Uploads can be parallel

        const cpuQueue: File[] = [];
        const netQueue: { file: File, resized: File, descriptors: any[] }[] = [];

        // Async pools
        const activeCpuTasks = new Set<Promise<void>>();
        const activeNetTasks = new Set<Promise<void>>();

        while ((queueRef.current.length > 0 || activeCpuTasks.size > 0 || activeNetTasks.size > 0) && !stopRef.current) {

            // Fill CPU Queue from Main Queue
            while (queueRef.current.length > 0 && activeCpuTasks.size < MAX_CPU_CONCURRENCY) {
                const file = queueRef.current.shift();
                if (file) {
                    setStats(prev => ({ ...prev, pending: queueRef.current.length }));

                    // Define task wrapper
                    const taskExecutor = async () => {
                        try {
                            // CPU INTENSIVE: Resize & Detect
                            const resizedBlob = await resizeImage(file, 1280);
                            const resizedFile = new File([resizedBlob], file.name, { type: 'image/jpeg' });

                            const img = await faceapi.bufferToImage(resizedBlob);
                            const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
                            const descriptors = detections.map(d => Array.from(d.descriptor)); // Float32Array to number[]

                            // Push to Network Queue
                            netQueue.push({ file, resized: resizedFile, descriptors });
                            setStats(prev => ({ ...prev, processed: prev.processed + 1 }));
                        } catch (err) {
                            console.error(`Error processing ${file.name}:`, err);
                            setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
                            addLog(`Failed to process: ${file.name}`);
                        }
                    };

                    const promise: Promise<void> = taskExecutor().then(() => {
                        activeCpuTasks.delete(promise);
                    });

                    activeCpuTasks.add(promise);
                }
            }

            // Fill Network Queue from Completed CPU tasks
            while (netQueue.length > 0 && activeNetTasks.size < MAX_NET_CONCURRENCY) {
                const item = netQueue.shift();
                if (item) {
                    const taskExecutor = async () => {
                        try {
                            const formData = new FormData();
                            formData.append("file", item.resized);
                            formData.append("descriptors", JSON.stringify(item.descriptors));

                            const res = await uploadPhoto(formData);

                            if (res.success) {
                                addToHistory(generateFileId(item.file));
                                setStats(prev => ({ ...prev, uploaded: prev.uploaded + 1 }));
                            } else {
                                throw new Error(res.error || "Unknown error");
                            }
                        } catch (err) {
                            console.error(`Error uploading ${item.file.name}:`, err);
                            setStats(prev => ({ ...prev, errors: prev.errors + 1 }));
                            addLog(`Upload failed: ${item.file.name}`);
                            // Optional: Retry logic here
                        }
                    };

                    const promise: Promise<void> = taskExecutor().then(() => {
                        activeNetTasks.delete(promise);
                    });

                    activeNetTasks.add(promise);
                }
            }

            // Wait for a slot to open
            await Promise.race([
                ...Array.from(activeCpuTasks),
                ...Array.from(activeNetTasks),
                new Promise(r => setTimeout(r, 100)) // Fallback tick
            ]);
        }

        processingRef.current = false;
        setIsUploading(false);
        addLog(stopRef.current ? "Paused." : "All Done!");
    };

    const handleStop = () => {
        stopRef.current = true;
        addLog("Stopping after current tasks...");
    };

    const clearHistory = () => {
        if (confirm("Clear upload history? This will allow re-uploading previously uploaded files.")) {
            localStorage.removeItem(HISTORY_KEY);
            setStats(prev => ({ ...prev, skipped: 0 }));
            addLog("History cleared.");
        }
    };

    return (
        <div className="w-full glass-panel p-8 bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl">
            <div className="flex flex-col items-center justify-center space-y-6">

                {/* Upload Icon */}
                <div className="relative">
                    <div className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center relative border border-zinc-700 overflow-hidden">
                        {isUploading ? (
                            <div className="absolute inset-0 rounded-full border-4 border-zinc-900 border-t-cyan-500 animate-spin" />
                        ) : (
                            <Upload className="w-8 h-8 text-zinc-400" />
                        )}
                        <div className="absolute inset-0 bg-cyan-500/10 animate-pulse rounded-full blur-xl" />
                    </div>
                    {modelLoaded && !isUploading && (
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
                        Drag & drop thousands of photos. We handle the rest.
                    </p>
                </div>

                {/* LOGS & STATS */}
                {(stats.total > 0 || logs.length > 0) && (
                    <div className="w-full space-y-3 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800/50 font-mono text-xs">
                        <div className="grid grid-cols-2 gap-2 text-center mb-2">
                            <div className="bg-zinc-800/50 p-2 rounded">
                                <span className="block text-zinc-500">Total</span>
                                <span className="text-white text-lg">{stats.total}</span>
                            </div>
                            <div className="bg-zinc-800/50 p-2 rounded">
                                <span className="block text-zinc-500">Processed</span>
                                <span className="text-green-400 text-lg">{stats.uploaded}</span>
                            </div>
                            <div className="bg-zinc-800/50 p-2 rounded">
                                <span className="block text-zinc-500">Skipped</span>
                                <span className="text-yellow-500 text-lg">{stats.skipped}</span>
                            </div>
                            <div className="bg-zinc-800/50 p-2 rounded">
                                <span className="block text-zinc-500">Pending</span>
                                <span className="text-blue-400 text-lg">{stats.pending}</span>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {isUploading && (
                            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 relative"
                                    style={{ width: `${(stats.uploaded + stats.skipped) / stats.total * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-shine" />
                                </div>
                            </div>
                        )}

                        <div className="h-16 overflow-y-auto space-y-1 text-zinc-400 border-t border-zinc-800/50 pt-2">
                            {logs.map((log, i) => (
                                <div key={i} className="truncate">{log}</div>
                            ))}
                        </div>
                    </div>
                )}


                <div className="flex gap-2 w-full">
                    <label className={`
                        flex-1 group relative cursor-pointer
                        ${isUploading || !modelLoaded ? 'opacity-50 pointer-events-none' : ''}
                    `}>
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
                        <div className="relative flex items-center justify-center gap-3 bg-zinc-900 ring-1 ring-white/10 rounded-xl px-8 py-4 leading-none text-white transition-all hover:bg-zinc-800 font-semibold shadow-2xl">
                            <span>{isUploading ? "Uploading..." : stats.total > 0 ? "Add More Photos" : "Select Photos"}</span>
                        </div>

                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFiles}
                            disabled={isUploading || !modelLoaded}
                        />
                    </label>

                    {isUploading && (
                        <button
                            onClick={handleStop}
                            className="px-4 py-2 bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors"
                        >
                            Stop
                        </button>
                    )}
                </div>

                <div className="flex justify-between w-full text-[10px] text-zinc-600">
                    <span>{status}</span>
                    {stats.skipped > 0 && (
                        <button onClick={clearHistory} className="hover:text-red-400 underline">
                            Clear Resume History
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

