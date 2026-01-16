"use client"

import { useState, useEffect, useRef, useCallback } from "react";
import { searchPhotos } from "@/actions/search";
import * as faceapi from "face-api.js";
import { Camera, Loader2, Download, Search, X, FlipHorizontal, ScanFace, Eye } from "lucide-react";
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
        setSearched(true);
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

    return (
        <div className="w-full max-w-6xl mx-auto space-y-12">

            {mode !== 'search' && (
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold text-white">
                        {mode === 'shared' ? "Shared Personal Album" : "Event Gallery"}
                    </h2>
                    {mode === 'shared' && <p className="text-zinc-400">Here are the photos picked just for you.</p>}
                </div>
            )}

            {loading && scannedImage && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.5)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={scannedImage} alt="Scanning" className="w-full h-full object-cover opacity-50 grayscale" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent h-4 w-full animate-[scan_2s_ease-in-out_infinite]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.2)_1px,transparent_1px)] bg-[size:20px_20px] opacity-30" />
                    </div>
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <div className="flex items-center gap-3 text-cyan-400 font-mono text-lg animate-pulse">
                            <ScanFace className="w-6 h-6" />
                            SCANNING FACE ID...
                        </div>
                        <p className="text-zinc-500 text-sm">Matching against thousands of memories</p>
                    </div>
                </div>
            )}

            {showUploadUI && (
                <div className="flex flex-col items-center justify-center space-y-6">
                    {cameraOpen ? (
                        <div className="relative w-full max-w-md aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                videoConstraints={{ facingMode: "user" }}
                                className="w-full h-full object-cover"
                            />
                            <button
                                onClick={() => setCameraOpen(false)}
                                className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                                <button
                                    onClick={handleCapture}
                                    className="bg-white rounded-full p-4 shadow-xl active:scale-95 transition"
                                >
                                    <div className="w-6 h-6 rounded-full border-2 border-black" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6">
                            <div className="relative group">
                                <div className={`
                    w-32 h-32 rounded-full bg-zinc-900 border-2 border-dashed border-zinc-700 
                    flex items-center justify-center overflow-hidden
                    group-hover:border-cyan-500
                    `}>
                                    <Camera className="w-10 h-10 text-zinc-500 group-hover:text-cyan-400 transition" />
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleUpload}
                                    disabled={loading || !modelLoaded}
                                />
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-cyan-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg whitespace-nowrap">
                                    UPLOAD FILE
                                </div>
                            </div>
                            <div className="text-zinc-500 text-sm">OR</div>
                            <button
                                onClick={() => setCameraOpen(true)}
                                disabled={!modelLoaded || loading}
                                className="bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-6 rounded-lg font-medium flex items-center gap-2 transition disabled:opacity-50"
                            >
                                <Camera className="w-5 h-5" />
                                Open Camera
                            </button>
                        </div>
                    )}
                    <p className="text-zinc-500 text-center max-w-sm">
                        {!modelLoaded ? "Loading AI..." : "Take or upload a selfie. We'll find every photo you're in."}
                    </p>
                </div>
            )}

            {searched && (
                <div className="space-y-4">
                    {mode === 'search' && (
                        <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                            <Search className="text-cyan-400" /> Found {photos.length} Photos
                        </h3>
                    )}

                    {photos.length === 0 && !loading ? (
                        <div className="text-center py-12 text-zinc-500 bg-zinc-900/50 rounded-xl">
                            No matches found.
                        </div>
                    ) : (
                        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                            {photos.map((photo) => (
                                <div key={photo.id} className="relative group break-inside-avoid">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={photo.url}
                                        alt="Memory"
                                        className="w-full rounded-lg bg-zinc-900 border border-zinc-800 group-hover:border-cyan-500/50 transition-all cursor-pointer"
                                        onClick={() => setSelectedPhoto(photo.url)}
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-lg backdrop-blur-sm">
                                        <button
                                            onClick={() => setSelectedPhoto(photo.url)}
                                            className="bg-white text-black p-2 rounded-full hover:scale-110 transition-transform"
                                            title="View Full Size"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                        <a
                                            href={photo.url}
                                            download={`photo-${photo.id}.jpg`}
                                            className="bg-white text-black p-2 rounded-full hover:scale-110 transition-transform"
                                            title="Download"
                                        >
                                            <Download className="w-5 h-5" />
                                        </a>
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200" onClick={() => setSelectedPhoto(null)}>
                    <button
                        className="absolute top-4 right-4 text-white hover:text-cyan-400 p-2 z-50"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={selectedPhoto}
                        alt="Full size memory"
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-zinc-800 object-contain"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
