import { Button } from "@/components/ui/button";
import { FlipHorizontal, Send, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { MainScreen } from "../App";
import { useCamera } from "../camera/useCamera";
import BottomNav from "../components/BottomNav";
import SendSnapSheet from "../components/SendSnapSheet";

interface CameraScreenProps {
  activeScreen: MainScreen;
  setActiveScreen: (s: MainScreen) => void;
}

export default function CameraScreen({
  activeScreen,
  setActiveScreen,
}: CameraScreenProps) {
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
  };

  const handleSendDone = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
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
                  ? "Kamera-Zugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen."
                  : error.message}
              </p>
              <Button
                onClick={() => startCamera()}
                className="rounded-full"
                style={{ background: "oklch(0.55 0.22 293)" }}
              >
                Erneut versuchen
              </Button>
            </>
          ) : (
            <div
              data-ocid="camera.loading_state"
              className="flex flex-col items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <p className="text-white/70 text-sm">Kamera wird gestartet...</p>
            </div>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <AnimatePresence>
        {!preview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-0 left-0 right-0"
          >
            {/* Bottom nav */}
            <div className="pb-4">
              <BottomNav
                active={activeScreen}
                onChange={setActiveScreen}
                onCamera={() => {}}
              />
            </div>

            {/* Shutter area above nav */}
            <div className="absolute bottom-24 left-0 right-0 flex items-center justify-center">
              <button
                type="button"
                data-ocid="camera.primary_button"
                onClick={handleCapture}
                disabled={!isActive || isLoading}
                className="w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95 amber-glow"
                style={{
                  background: "oklch(0.75 0.18 75)",
                  border: "4px solid rgba(255,255,255,0.8)",
                  boxShadow:
                    "0 0 0 2px oklch(0.75 0.18 75 / 0.4), 0 8px 32px rgba(0,0,0,0.4)",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview overlay */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
          >
            <img
              src={preview.url}
              alt="Snap preview"
              className="w-full h-full object-cover"
            />

            {/* Preview controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6 flex items-center justify-between">
              <button
                type="button"
                data-ocid="camera.cancel_button"
                onClick={handleDiscard}
                className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm"
              >
                <X className="w-6 h-6 text-white" />
              </button>

              <button
                type="button"
                data-ocid="camera.primary_button"
                onClick={() => setShowSendSheet(true)}
                className="flex items-center gap-2 px-6 py-4 rounded-full font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, oklch(0.55 0.22 293), oklch(0.48 0.2 280))",
                }}
              >
                <Send className="w-5 h-5" />
                Senden
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send snap sheet */}
      {preview && showSendSheet && (
        <SendSnapSheet
          open={showSendSheet}
          onClose={() => setShowSendSheet(false)}
          snapBytes={preview.bytes}
          onSent={handleSendDone}
        />
      )}
    </div>
  );
}
