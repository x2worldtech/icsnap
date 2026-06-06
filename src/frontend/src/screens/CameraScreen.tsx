import { Button } from "@/components/ui/button";
import { FlipHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { MainScreen } from "../App";
import { useCamera } from "../camera/useCamera";
import ErrorBoundary from "../components/ErrorBoundary";
import SendSnapSheet from "../components/SendSnapSheet";
import SnapEditor from "../components/SnapEditor";

interface CameraScreenProps {
  activeScreen: MainScreen;
}

export default function CameraScreen({ activeScreen }: CameraScreenProps) {
  const {
    isActive,
    isLoading,
    error,

    videoRef,
    canvasRef,
    startCamera,
    capturePhoto,
    switchCamera,
    currentFacingMode,
  } = useCamera({
    facingMode: "environment",
    quality: 0.9,
  });

  const [preview, setPreview] = useState<{
    url: string;
    bytes: Uint8Array;
  } | null>(null);
  // annotated bytes from SnapEditor (replaces raw bytes for send)
  const [annotatedBytes, setAnnotatedBytes] = useState<Uint8Array | null>(null);
  const [showSendSheet, setShowSendSheet] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current && activeScreen === "camera") {
      started.current = true;
      startCamera();
    }
  }, [startCamera, activeScreen]);

  const handleCapture = async () => {
    const file = await capturePhoto();
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const url = URL.createObjectURL(file);
    setPreview({ url, bytes });
  };

  const handleDiscard = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setAnnotatedBytes(null);
  };

  const handleEditorSend = async (blob: Blob) => {
    const arrayBuffer = await blob.arrayBuffer();
    setAnnotatedBytes(new Uint8Array(arrayBuffer));
    setShowSendSheet(true);
  };

  const handleSendDone = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setAnnotatedBytes(null);
    setShowSendSheet(false);
  };

  return (
    <div className="relative h-full bg-black overflow-hidden">
      {/* Camera viewfinder */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
        style={{
          transform: currentFacingMode === "user" ? "scaleX(-1)" : "none",
        }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Top gradient overlay */}
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
        }}
      />

      {/* Logo top left */}
      <div className="absolute top-safe-top top-12 left-5 flex items-center gap-2">
        <span className="text-white font-bold text-xl tracking-tight drop-shadow-lg">
          ICSnap
        </span>
      </div>

      {/* Flip camera button top right */}
      {!preview && (
        <button
          type="button"
          data-ocid="camera.toggle"
          onClick={() => switchCamera()}
          disabled={isLoading}
          className="absolute top-12 right-5 w-10 h-10 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm"
        >
          <FlipHorizontal className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Loading / error state */}
      {!isActive && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {error ? (
            <>
              <p
                data-ocid="camera.error_state"
                className="text-white text-center px-6"
              >
                {error.type === "permission"
                  ? "Camera access denied. Please allow access in your browser settings."
                  : error.message}
              </p>
              <Button
                onClick={() => startCamera()}
                className="rounded-full"
                style={{ background: "oklch(var(--primary))" }}
              >
                Try again
              </Button>
            </>
          ) : (
            <div
              data-ocid="camera.loading_state"
              className="flex flex-col items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <p className="text-white/70 text-sm">Starting camera…</p>
            </div>
          )}
        </div>
      )}

      {/* Shutter */}
      <AnimatePresence>
        {!preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-8 left-0 right-0 flex items-center justify-center"
          >
            <button
              type="button"
              data-ocid="camera.primary_button"
              onClick={handleCapture}
              disabled={!isActive || isLoading}
              className="w-[4.75rem] h-[4.75rem] rounded-full flex items-center justify-center transition-transform active:scale-95 snap-glow"
              style={{
                background: "oklch(var(--accent))",
                border: "4px solid rgba(255,255,255,0.9)",
                boxShadow:
                  "0 0 0 2px oklch(var(--accent) / 0.4), 0 8px 32px rgba(0,0,0,0.4)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snap Editor overlay */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            data-noswipe="true"
          >
            <ErrorBoundary onReset={handleDiscard}>
              <SnapEditor
                capturedImage={preview.url}
                onSend={handleEditorSend}
                onDiscard={handleDiscard}
              />
            </ErrorBoundary>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send snap sheet */}
      {preview && showSendSheet && (
        <SendSnapSheet
          open={showSendSheet}
          onClose={() => setShowSendSheet(false)}
          snapBytes={annotatedBytes ?? preview.bytes}
          onSent={handleSendDone}
        />
      )}
    </div>
  );
}
