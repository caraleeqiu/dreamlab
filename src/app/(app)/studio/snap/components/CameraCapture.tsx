'use client';

/**
 * CameraCapture Component
 *
 * Handles camera access and photo capture
 * Supports both front and back camera
 */

import { useState, useRef, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (imageDataUrl: string) => void;
  onError?: (error: Error) => void;
}

export function CameraCapture({ onCapture, onError }: CameraCaptureProps) {
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('Camera access denied'));
    }
  }, [facingMode, onError]);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    setIsActive(false);
  }, []);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    // Will restart with new facing mode on next startCamera call
  }, [stopCamera]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(dataUrl);
    stopCamera();
  }, [onCapture, stopCamera]);

  return (
    <div className="relative">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video preview */}
      <div className="aspect-[4/3] bg-black rounded-2xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${!isActive && 'hidden'}`}
        />
        {!isActive && (
          <div className="w-full h-full flex items-center justify-center">
            <button
              onClick={startCamera}
              className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <span className="text-5xl">📷</span>
              <span>点击打开摄像头</span>
            </button>
          </div>
        )}
      </div>

      {/* Controls */}
      {isActive && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
          {/* Switch camera */}
          <button
            onClick={switchCamera}
            className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center"
          >
            🔄
          </button>

          {/* Capture button */}
          <button
            onClick={capture}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-4 border-slate-300"
          >
            <div className="w-12 h-12 bg-white rounded-full" />
          </button>

          {/* Cancel */}
          <button
            onClick={stopCamera}
            className="w-12 h-12 bg-slate-800/80 rounded-full flex items-center justify-center"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
