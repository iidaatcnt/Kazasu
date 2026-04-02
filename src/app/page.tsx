"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Scan, Volume2, Square, RotateCcw, HelpCircle, Loader2 } from "lucide-react";
import { createWorker } from "tesseract.js";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "camera" | "scanning" | "result";

export default function Home() {
  const [mode, setMode] = useState<Mode>("camera");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ocrText, setOcrText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("カメラの起動に失敗しました。カメラの使用を許可してください。");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [mode, startCamera, stopCamera]);

  // Handle Capture & OCR
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = canvas.toDataURL("image/jpeg");

    setMode("scanning");
    setIsProcessing(true);

    try {
      const worker = await createWorker("jpn+eng");
      const { data: { text } } = await worker.recognize(imageData);
      await worker.terminate();
      
      setOcrText(text.replace(/\s+/g, ' ').trim());
      setMode("result");
    } catch (err) {
      console.error("OCR Error:", err);
      setError("文字の読み取り中にエラーが発生しました。");
      setMode("camera");
    } finally {
      setIsProcessing(false);
    }
  };

  // Text to Speech
  const speakText = () => {
    if (!ocrText) return;

    // Reset any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(ocrText);
    utterance.lang = "ja-JP";
    utterance.rate = 0.9; // Slightly slower for clarity
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <main className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      {/* Header */}
      <div className="glass-morphism z-30 flex h-16 items-center justify-between px-6 pb-2 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary">かざす</h1>
        <button className="rounded-full p-2 text-foreground/60 transition-colors hover:bg-foreground/5 active:scale-95">
          <HelpCircle size={24} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {/* CAMERA MODE */}
          {mode === "camera" && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative h-full w-full"
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />
              
              {/* Camera UI Overlays */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="h-64 w-[85%] rounded-3xl border-2 border-white/50 shadow-[0_0_0_1000px_rgba(0,0,0,0.4)]" />
                <p className="mt-8 rounded-full bg-black/40 px-6 py-2 text-sm font-medium text-white backdrop-blur-md">
                  新聞の文字を枠に合わせてください
                </p>
              </div>

              {/* Action Button */}
              <div className="absolute bottom-12 flex w-full justify-center">
                <button
                  onClick={handleCapture}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-white p-1 shadow-2xl transition-transform active:scale-90"
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full border-4 border-black/5 bg-primary text-white">
                    <Camera size={32} />
                  </div>
                </button>
              </div>
            </motion.div>
          )}

          {/* SCANNING MODE */}
          {mode === "scanning" && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-full flex-col items-center justify-center gap-8 bg-black/20"
            >
              <div className="relative h-64 w-[85%] overflow-hidden rounded-3xl bg-black/60 shadow-2xl">
                <div className="scan-line" />
                <canvas ref={canvasRef} className="h-full w-full object-cover opacity-50" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="animate-spin text-primary" size={40} />
                <p className="text-xl font-bold tracking-wider text-foreground">
                  文字を読み取っています...
                </p>
              </div>
            </motion.div>
          )}

          {/* RESULT MODE */}
          {mode === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex h-full flex-col p-6"
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-bold text-primary">
                  読み取り結果
                </span>
                <button
                  onClick={() => setMode("camera")}
                  className="flex items-center gap-2 text-foreground/60 active:scale-95 transition-colors"
                >
                  <RotateCcw size={20} />
                  <span>やり直す</span>
                </button>
              </div>

              <div className="glass-morphism flex-1 overflow-y-auto rounded-3xl p-6 shadow-sm">
                <p className="text-2xl leading-relaxed tracking-wide text-foreground/90">
                  {ocrText || "文字が検出されませんでした。もう一度試してください。"}
                </p>
              </div>

              {/* Voice Controls */}
              <div className="mt-8 flex flex-col gap-4 pb-8">
                {isSpeaking ? (
                  <button
                    onClick={stopSpeaking}
                    className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-accent text-white shadow-lg shadow-accent/20 active:scale-[0.98] transition-transform"
                  >
                    <Square fill="white" size={28} />
                    <span className="text-2xl font-bold">読み上げを止める</span>
                  </button>
                ) : (
                  <button
                    onClick={speakText}
                    className="flex h-20 w-full items-center justify-center gap-3 rounded-3xl bg-primary text-white shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
                  >
                    <Volume2 size={32} />
                    <span className="text-2xl font-bold">大きな声で聞く</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Internal Hidden Canvas for screenshot */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-24 left-6 right-6 z-50 rounded-2xl bg-red-500 p-4 text-center text-white shadow-xl">
          {error}
        </div>
      )}
    </main>
  );
}
