"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { searchPhotos } from "@/actions/search";
import * as faceapi from "face-api.js";
import { Camera, Loader2, Download, Search, X, ScanFace, Eye, Sparkles } from "lucide-react";
import Webcam from "react-webcam";
import { resizeImage } from "@/utils/image";

interface GuestSearchProps {
    initialPhotos?: any[];
    mode?: 'search' | 'shared' | 'all';
}

export default function GuestSearch({ initialPhotos = [], mode = 'search' }: GuestSearchProps) {
    const [loading, setLoading] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [photos, setPhotos] = useState<any[]>(initialPhotos);
    const [searched, setSearched] = useState(initialPhotos.length > 0);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scannedImage, setScannedImage] = useState<string | null>(null);
    const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
    const webcamRef = useRef<Webcam>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    useEffect(() => {
        if (mode === 'search') {
            const loadModels = async () => {
                const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
                try {
                    await Promise.all([
                        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    ]);
                    setModelLoaded(true);
                } catch (e) {
                    console.error(e);
                }
            };
            loadModels();
        }
    }, [mode]);

    const processImage = async (imageSrc: string | Blob) => {
        setLoading(true);
        // Do NOT set searched here immediately
        setCameraOpen(false);

        if (typeof imageSrc === 'string') {
            setScannedImage(imageSrc);
        } else {
            setScannedImage(URL.createObjectURL(imageSrc));
        }

        try {
            let img;
            if (typeof imageSrc === "string") {
                img = await faceapi.fetchImage(imageSrc);
            } else {
                img = await faceapi.bufferToImage(imageSrc);
            }

            const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();

            if (detections.length === 0) {
                alert("No face detected in selfie. Please try again.");
                setLoading(false);
                setScannedImage(null);
                return;
            }

            const descriptor = Array.from(detections[0].descriptor);

            const res = await searchPhotos(descriptor);
            if (res.success) {
                const existingIds = new Set();
                const unique = (res.photos || []).filter((p: any) => {
                    if (existingIds.has(p.id)) return false;
                    existingIds.add(p.id);
                    return true;
                });
                setPhotos(unique);
                setSearched(true); // Set searched only on success
            } else {
                alert("Search error");
            }
        } catch (err) {
            console.error(err);
            alert("Error processing image");
        } finally {
            setLoading(false);
            setScannedImage(null);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (!modelLoaded) return alert("Models not loaded yet");

        try {
            const file = e.target.files[0];
            const resizedBlob = await resizeImage(file, 1280);
            processImage(resizedBlob);
        } catch (e) {
            console.error(e);
            alert("Error resizing image");
        }
    };

    const handleCapture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            processImage(imageSrc);
        }
    }, [webcamRef]);

    const showUploadUI = !searched && mode === 'search';

    const downloadImage = async (url: string, filename: string, id: string) => {
        setDownloadingId(id);
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(objectUrl);
        } catch (error) {
            console.error('Download failed:', error);
            // Fallback to opening in new tab
            window.open(url, '_blank');
        } finally {
            setDownloadingId(null);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-12 animate-enter">

            {/* Hero Section (Search Mode) */}
            {mode === 'search' && !searched && (
                <div className="text-center space-y-4 pt-10">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-zinc-500">
                        The Wedding<br />Gallery
                    </h1>
                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto font-light">
                        Experience the magic again. <br className="hidden md:block" />
                        <span className="text-cyan-400 font-medium">Take a selfie</span> to instantly find every memory you're part of.
                    </p>
                </div>
            )}

            {/* Header for Shared/All Mode */}
            {mode !== 'search' && (
                <div className="text-center space-y-2 pt-10">
                    <h2 className="text-4xl font-bold text-white tracking-tight">
                        {mode === 'shared' ? "Your Personal Album" : "Event Gallery"}
                    </h2>
                    {mode === 'shared' && <p className="text-zinc-400">Curated memories, just for you.</p>}
                </div>
            )}

            {/* Scanning Overlay */}
            {loading && scannedImage && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black backdrop-blur-3xl animate-in fade-in duration-300">
                    <div className="relative">
                        {/* Scanner Frame */}
                        <div className="relative w-80 h-80 rounded-2xl overflow-hidden border-2 border-cyan-500/30 shadow-[0_0_100px_rgba(6,182,212,0.2)] bg-zinc-900">
                            {/* Target Image */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={scannedImage} alt="Scanning" className="w-full h-full object-cover opacity-60" />

                            {/* Grid Overlay */}
                            <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />

                            {/* Moving Scan Line */}
                            <div className="absolute left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,1)] animate-scan-vertical" />

                            {/* Scanning Radar/Ripple Effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 via-transparent to-transparent animate-scan-vertical opacity-30" />
                        </div>

                        {/* Corner Brackets */}
                        <div className="absolute -inset-6 pointer-events-none">
                            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-cyan-500 rounded-tl-3xl opacity-80" />
                            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-cyan-500 rounded-tr-3xl opacity-80" />
                            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-cyan-500 rounded-bl-3xl opacity-80" />
                            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-cyan-500 rounded-br-3xl opacity-80" />
                        </div>
                    </div>

                    <div className="mt-12 flex flex-col items-center gap-6">
                        <div className="flex items-center gap-4">
                            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                            <span className="text-cyan-400 font-mono text-xl tracking-[0.3em] font-medium animate-pulse shadow-cyan-500/50">
                                ANALYZING
                            </span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <p className="text-zinc-400 text-sm font-light">Matching biometric features...</p>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce delay-0" />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce delay-100" />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce delay-200" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Search Input Area */}
            {showUploadUI && (
                <div className="flex flex-col items-center justify-center space-y-8 bg-black/50 p-8 rounded-3xl border border-white/5 backdrop-blur-sm max-w-2xl mx-auto shadow-2xl shadow-black/50">

                    {cameraOpen ? (
                        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-zinc-800">
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user" }}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => setCameraOpen(false)}
                                className="absolute top-4 right-4 bg-black/50 text-white p-2.5 rounded-full backdrop-blur-md hover:bg-black/70 transition-all border border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                                <button
                                    onClick={handleCapture}
                                    className="bg-white rounded-full p-1 shadow-2xl hover:scale-105 transition-transform"
                                >
                                    <div className="w-16 h-16 rounded-full border-4 border-black bg-white" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-stretch">
                            {/* Upload Area */}
                            <div className="relative group flex-1">
                                <div className={`
                                    h-40 md:h-48 rounded-2xl bg-zinc-900/50 border-2 border-dashed border-zinc-700 
                                    flex flex-col items-center justify-center gap-4
                                    group-hover:border-cyan-500/50 group-hover:bg-zinc-900
                                    transition-all duration-300 cursor-pointer
                                `}>
                                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Sparkles className="w-6 h-6 text-zinc-400 group-hover:text-cyan-400" />
                                    </div>
                                    <span className="text-zinc-400 group-hover:text-white font-medium">Upload a Selfie</span>
                                </div>

                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleUpload}
                                    disabled={loading || !modelLoaded}
                                />
                            </div>

                            <div className="flex items-center justify-center text-zinc-600 font-mono text-sm">OR</div>

                            {/* Camera Button */}
                            <button
                                onClick={() => setCameraOpen(true)}
                                disabled={!modelLoaded || loading}
                                className="flex-1 h-40 md:h-48 rounded-2xl bg-gradient-to-br from-cyan-600/10 to-blue-600/10 border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all flex flex-col items-center justify-center gap-4 group"
                            >
                                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 transition-transform border border-cyan-500/20">
                                    <Camera className="w-6 h-6 text-cyan-400" />
                                </div>
                                <span className="text-cyan-100 font-medium">Open Camera</span>
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-zinc-500 text-sm bg-black/40 px-4 py-2 rounded-full border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${modelLoaded ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
                        {modelLoaded ? "AI Face Engine Ready" : "Initializing Neural Networks..."}
                    </div>
                </div>
            )}

            {/* Results Grid */}
            {searched && (
                <div className="space-y-8">
                    {mode === 'search' && (
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-white flex items-center justify-center gap-3">
                                <Sparkles className="text-cyan-400" />
                                We found {photos.length} memories
                            </h3>
                            {photos.length > 0 && <p className="text-zinc-400">Tap any photo to view in full quality.</p>}
                        </div>
                    )}

                    {photos.length === 0 && !loading ? (
                        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-3xl backdrop-blur-sm max-w-lg mx-auto">
                            <h4 className="text-xl font-medium text-zinc-300">No matches found</h4>
                            <p className="text-zinc-500 mt-2">Try uploading a clear photo with good lighting.</p>
                            <button onClick={() => window.location.reload()} className="mt-6 text-cyan-400 hover:text-cyan-300 hover:underline">
                                Try Again
                            </button>
                        </div>
                    ) : (
                        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 px-4">
                            {photos.map((photo) => (
                                <div key={photo.id} className="relative group break-inside-avoid rounded-xl overflow-hidden shadow-lg cursor-zoom-in" onClick={() => setSelectedPhoto(photo.url)}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={photo.url}
                                        alt="Memory"
                                        className="w-full bg-zinc-900 hover:scale-[1.02] transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                                        <div className="flex gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedPhoto(photo.url); }}
                                                className="bg-white/10 backdrop-blur-md text-white p-2.5 rounded-full hover:bg-white/20 transition-colors border border-white/10"
                                                title="View"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    downloadImage(photo.url, `photo-${photo.id}.jpg`, photo.id);
                                                }}
                                                disabled={downloadingId === photo.id}
                                                className="bg-white text-black p-2.5 rounded-full hover:bg-cyan-50 transition-colors shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50"
                                                title="Download"
                                            >
                                                {downloadingId === photo.id ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <Download className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {mode !== 'search' && (
                        <div className="flex justify-center pt-8 border-t border-zinc-800">
                            <a href="/guest" className="text-zinc-500 hover:text-white text-sm">
                                Not you? <span className="underline">Find your own photos</span>
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* View Photo Modal */}
            {selectedPhoto && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-300" onClick={() => setSelectedPhoto(null)}>
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white p-2 z-50 transition-colors bg-white/10 rounded-full hover:bg-white/20"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selectedPhoto}
                        alt="Full size memory"
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain animate-in zoom-in-95 duration-300"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
