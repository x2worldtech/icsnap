import {
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Send,
  Sticker,
  Type,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  color: string;
  fontSize: number;
  fontFamily: string;
  rotation: number; // degrees
  scale: number;
}

interface DrawStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

interface SnapEditorProps {
  capturedImage: string;
  onSend: (blob: Blob) => void;
  onDiscard: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TEXT_COLORS = [
  "#ffffff",
  "#ffd700",
  "#ff4444",
  "#4488ff",
  "#44cc44",
  "#000000",
];
const DRAW_COLORS = [
  "#ffffff",
  "#ff4444",
  "#ffd700",
  "#4488ff",
  "#44cc44",
  "#000000",
  "#7c3aed",
];
const STROKE_WIDTHS = [
  { label: "S", value: 2 },
  { label: "M", value: 5 },
  { label: "L", value: 12 },
];
const FONT_OPTIONS = [
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
];
const SNAP_ROTATION_THRESHOLD = 10;
const SNAP_CENTER_THRESHOLD = 20;

// Classic photo filters (swipe left/right over the snap to switch).
const FILTERS: { name: string; css: string }[] = [
  { name: "Original", css: "none" },
  { name: "Mono", css: "grayscale(1) contrast(1.05)" },
  { name: "Noir", css: "grayscale(1) contrast(1.3) brightness(0.92)" },
  { name: "Vivid", css: "saturate(1.5) contrast(1.12)" },
  {
    name: "Warm",
    css: "sepia(0.35) saturate(1.4) hue-rotate(-12deg) brightness(1.04)",
  },
  {
    name: "Cool",
    css: "saturate(1.15) hue-rotate(14deg) brightness(1.05) contrast(1.02)",
  },
  { name: "Sepia", css: "sepia(0.75) contrast(1.05) brightness(1.03)" },
  {
    name: "Mocha",
    css: "sepia(0.45) saturate(1.25) contrast(1.12) brightness(0.96)",
  },
  { name: "Fade", css: "saturate(0.82) contrast(0.92) brightness(1.08)" },
  { name: "Punch", css: "contrast(1.28) saturate(1.32) brightness(1.02)" },
];

// Sticker overlays available in the "Overlays" panel.
const STICKERS = [
  "😀", "😎", "🔥", "❤️", "😂", "🎉", "👍", "⭐",
  "💯", "🥳", "😍", "🙌", "✨", "🤙", "🌟", "💙",
];

function uid() {
  return Math.random().toString(36).slice(2);
}

const getTouchDist = (t: React.TouchList) =>
  Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);
const getTouchAngle = (t: React.TouchList) =>
  (Math.atan2(t[1].clientY - t[0].clientY, t[1].clientX - t[0].clientX) * 180) /
  Math.PI;

// ─── Component ────────────────────────────────────────────────────────────────
export default function SnapEditor({
  capturedImage,
  onSend,
  onDiscard,
}: SnapEditorProps) {
  // Active tool
  const [tool, setTool] = useState<"none" | "text" | "draw" | "overlays">(
    "none",
  );

  // Filter state
  const [filterIndex, setFilterIndex] = useState(0);
  const [filterFlash, setFilterFlash] = useState(false);
  const filterSwipe = useRef<{ x: number; y: number } | null>(null);
  const activeFilter = FILTERS[filterIndex];

  // Text state
  const [textInput, setTextInput] = useState("");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [textFont, setTextFont] = useState(FONT_OPTIONS[0].value);
  const [textSize, setTextSize] = useState(32);
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [snapHint, setSnapHint] = useState<"rotation" | "center" | null>(null);

  // Draw state
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const currentStroke = useRef<DrawStroke | null>(null);
  const isDrawing = useRef(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const livePathRef = useRef<SVGPathElement>(null);
  const exportImgRef = useRef<HTMLImageElement>(new Image());

  // Preload the image for export
  useEffect(() => {
    exportImgRef.current.src = capturedImage;
    exportImgRef.current.crossOrigin = "anonymous";
  }, [capturedImage]);

  // ── Snap hint flash ─────────────────────────────────────────────────────────
  const flashHint = useCallback((hint: "rotation" | "center") => {
    setSnapHint(hint);
    setTimeout(() => setSnapHint(null), 700);
  }, []);

  // ── Add text overlay ────────────────────────────────────────────────────────
  const handleAddText = () => {
    if (!textInput.trim()) return;
    const overlay: TextOverlay = {
      id: uid(),
      text: textInput.trim(),
      x: 50,
      y: 50,
      color: textColor,
      fontSize: textSize,
      fontFamily: textFont,
      rotation: 0,
      scale: 1,
    };
    setOverlays((prev) => [...prev, overlay]);
    setTextInput("");
    setSelectedId(overlay.id);
  };

  // ── Delete text overlay ─────────────────────────────────────────────────────
  const deleteOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  // ── Drag single finger ──────────────────────────────────────────────────────
  const dragState = useRef<{
    id: string;
    startTouchX: number;
    startTouchY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const handleOverlayTouchStart = useCallback(
    (e: React.TouchEvent, id: string) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const overlay = overlays.find((o) => o.id === id);
        if (!overlay) return;
        dragState.current = {
          id,
          startTouchX: e.touches[0].clientX,
          startTouchY: e.touches[0].clientY,
          startX: overlay.x,
          startY: overlay.y,
        };
        setSelectedId(id);
      }
    },
    [overlays],
  );

  // ── Two-finger pinch/rotate ──────────────────────────────────────────────────
  const gestureState = useRef<{
    id: string;
    initialDist: number;
    initialAngle: number;
    initialScale: number;
    initialRotation: number;
  } | null>(null);

  const handleOverlayTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

      if (e.touches.length === 1 && dragState.current) {
        const dx =
          ((e.touches[0].clientX - dragState.current.startTouchX) /
            rect.width) *
          100;
        const dy =
          ((e.touches[0].clientY - dragState.current.startTouchY) /
            rect.height) *
          100;
        let newX = dragState.current.startX + dx;
        let newY = dragState.current.startY + dy;

        // Snap center-X
        let snapped = false;
        if (Math.abs(newX - 50) < (SNAP_CENTER_THRESHOLD / rect.width) * 100) {
          newX = 50;
          snapped = true;
        }
        if (snapped) flashHint("center");

        setOverlays((prev) =>
          prev.map((o) =>
            o.id === dragState.current!.id ? { ...o, x: newX, y: newY } : o,
          ),
        );
      } else if (e.touches.length === 2) {
        // Start gesture tracking if not started
        const targetId =
          gestureState.current?.id ?? (dragState.current?.id || selectedId);
        if (!targetId) return;

        const overlay = overlays.find((o) => o.id === targetId);
        if (!overlay) return;

        const dist = getTouchDist(e.touches);
        const angle = getTouchAngle(e.touches);

        if (!gestureState.current) {
          gestureState.current = {
            id: targetId,
            initialDist: Math.max(dist, 1),
            initialAngle: angle,
            initialScale: overlay.scale,
            initialRotation: overlay.rotation,
          };
          return;
        }

        const scaleFactor = dist / gestureState.current.initialDist;
        const newScale = Math.max(
          0.3,
          Math.min(5, gestureState.current.initialScale * scaleFactor),
        );

        const deltaAngle = angle - gestureState.current.initialAngle;
        let newRotation = gestureState.current.initialRotation + deltaAngle;

        // Snap rotation to 0
        let rotSnapped = false;
        if (Math.abs(newRotation) < SNAP_ROTATION_THRESHOLD) {
          newRotation = 0;
          rotSnapped = true;
        }
        if (rotSnapped) flashHint("rotation");

        setOverlays((prev) =>
          prev.map((o) =>
            o.id === gestureState.current!.id
              ? { ...o, scale: newScale, rotation: newRotation }
              : o,
          ),
        );
      }
      } catch {
        // A gesture glitch must never crash the editor.
      }
    },
    [overlays, selectedId, flashHint],
  );

  const handleOverlayTouchEnd = useCallback(() => {
    dragState.current = null;
    gestureState.current = null;
  }, []);

  // ── Drawing (declarative SVG so committed strokes can never be lost) ─────────
  const getPos = (
    clientX: number,
    clientY: number,
  ): { x: number; y: number } => {
    const c = containerRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const pointsToPath = (pts: { x: number; y: number }[]): string => {
    if (!pts || pts.length === 0) return "";
    if (pts.length === 1) {
      return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.01} ${pts[0].y}`;
    }
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
  };

  // The in-progress stroke is drawn imperatively on ONE <path> so moving the pen
  // never re-renders the editor — and committed strokes (React elements) stay put.
  const updateLivePath = () => {
    const path = livePathRef.current;
    if (!path) return;
    const s = currentStroke.current;
    if (!s) {
      path.setAttribute("d", "");
      return;
    }
    path.setAttribute("d", pointsToPath(s.points));
    path.setAttribute("stroke", s.color);
    path.setAttribute("stroke-width", String(s.width));
  };

  const startStroke = (clientX: number, clientY: number) => {
    if (tool !== "draw") return;
    currentStroke.current = {
      id: uid(),
      points: [getPos(clientX, clientY)],
      color: drawColor,
      width: strokeWidth,
    };
    isDrawing.current = true;
    updateLivePath();
  };

  const extendStroke = (clientX: number, clientY: number) => {
    if (!isDrawing.current || !currentStroke.current) return;
    currentStroke.current.points.push(getPos(clientX, clientY));
    updateLivePath();
  };

  const endStroke = () => {
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;
    const finished: DrawStroke = {
      id: currentStroke.current.id,
      color: currentStroke.current.color,
      width: currentStroke.current.width,
      points: [...currentStroke.current.points],
    };
    currentStroke.current = null;
    updateLivePath(); // clears the live path
    if (finished.points.length >= 2) {
      setStrokes((prev) => [...prev, finished]);
    }
  };

  // Touch draw events
  const handleDrawTouchStart = (e: React.TouchEvent) => {
    if (tool !== "draw") return;
    e.preventDefault();
    startStroke(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleDrawTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    extendStroke(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleDrawTouchEnd = () => {
    endStroke();
  };

  // Mouse draw (desktop fallback)
  const handleDrawMouseDown = (e: React.MouseEvent) => {
    startStroke(e.clientX, e.clientY);
  };

  const handleDrawMouseMove = (e: React.MouseEvent) => {
    extendStroke(e.clientX, e.clientY);
  };

  const handleDrawMouseUp = () => {
    endStroke();
  };

  // ── Overlays: stickers / time / date / location ─────────────────────────────
  const addOverlay = (text: string, fontSize = 44) => {
    const overlay: TextOverlay = {
      id: uid(),
      text,
      x: 50,
      y: 45,
      color: "#ffffff",
      fontSize,
      fontFamily: "sans-serif",
      rotation: 0,
      scale: 1,
    };
    setOverlays((prev) => [...prev, overlay]);
    setSelectedId(overlay.id);
    setTool("none");
  };

  const addTimeOverlay = () => {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, "0");
    const mm = now.getMinutes().toString().padStart(2, "0");
    addOverlay(`${hh}:${mm}`, 40);
  };

  const addDateOverlay = () => {
    const txt = new Date().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    addOverlay(txt, 32);
  };

  const addLocationOverlay = () => {
    if (!("geolocation" in navigator)) {
      addOverlay("📍 Location", 30);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(2);
        const lng = pos.coords.longitude.toFixed(2);
        addOverlay(`📍 ${lat}, ${lng}`, 28);
      },
      () => addOverlay("📍 Location", 30),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  // ── Filters: swipe left/right over the snap ──────────────────────────────────
  const flashFilterName = useCallback(() => {
    setFilterFlash(true);
    window.setTimeout(() => setFilterFlash(false), 900);
  }, []);

  const changeFilter = useCallback(
    (dir: 1 | -1) => {
      setFilterIndex((i) => (i + dir + FILTERS.length) % FILTERS.length);
      flashFilterName();
    },
    [flashFilterName],
  );

  const onContainerTouchStart = (e: React.TouchEvent) => {
    if (tool === "draw") {
      handleDrawTouchStart(e);
      return;
    }
    if (tool === "none" && e.touches.length === 1) {
      filterSwipe.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const onContainerTouchMove = (e: React.TouchEvent) => {
    if (tool === "draw") handleDrawTouchMove(e);
  };

  const onContainerTouchEnd = (e: React.TouchEvent) => {
    if (tool === "draw") {
      handleDrawTouchEnd();
      return;
    }
    if (tool === "none" && filterSwipe.current) {
      const t = e.changedTouches[0];
      const dx = t.clientX - filterSwipe.current.x;
      const dy = t.clientY - filterSwipe.current.y;
      filterSwipe.current = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        changeFilter(dx < 0 ? 1 : -1);
      }
    }
  };

  // ── Composite and export ─────────────────────────────────────────────────────
  const handleSend = async () => {
    try {
      const container = containerRef.current;
      if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.max(1, Math.round(width * dpr));
    exportCanvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // 1. Draw base image (with the active photo filter applied)
    const img = exportImgRef.current;
    const drawBase = () => {
      ctx.filter = activeFilter.css === "none" ? "none" : activeFilter.css;
      ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
      ctx.filter = "none";
    };
    if (img.complete) {
      drawBase();
    } else {
      await new Promise<void>((res) => {
        img.onload = () => res();
      });
      drawBase();
    }

      // 2. Draw strokes (points are in CSS px; scale to export resolution)
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width * dpr;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.moveTo(stroke.points[0].x * dpr, stroke.points[0].y * dpr);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * dpr, stroke.points[i].y * dpr);
        }
        ctx.stroke();
      }

    // 3. Draw text overlays
    for (const ov of overlays) {
      const cx = (ov.x / 100) * width * dpr;
      const cy = (ov.y / 100) * height * dpr;
      const fontSize = ov.fontSize * ov.scale * dpr;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((ov.rotation * Math.PI) / 180);
      ctx.font = `bold ${fontSize}px ${ov.fontFamily}`;
      ctx.fillStyle = ov.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // text shadow
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 6 * dpr;
      ctx.fillText(ov.text, 0, 0);
      ctx.restore();
    }

    exportCanvas.toBlob(
      (blob) => {
        if (blob) onSend(blob);
      },
      "image/jpeg",
      0.9,
    );
    } catch {
      // Export failed — keep the editor open instead of crashing.
    }
  };

  // ── Tap on container to deselect text ────────────────────────────────────────
  const handleContainerTap = () => {
    if (tool !== "draw") setSelectedId(null);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: "#000", touchAction: "none" }}
      onTouchStart={onContainerTouchStart}
      onTouchMove={onContainerTouchMove}
      onTouchEnd={onContainerTouchEnd}
      onMouseDown={tool === "draw" ? handleDrawMouseDown : undefined}
      onMouseMove={tool === "draw" ? handleDrawMouseMove : undefined}
      onMouseUp={tool === "draw" ? handleDrawMouseUp : undefined}
      onClick={handleContainerTap}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleContainerTap();
      }}
      role="presentation"
    >
      {/* Background image */}
      <img
        src={capturedImage}
        alt="Snap"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
        style={{ filter: activeFilter.css }}
      />

      {/* Drawing layer (SVG — committed strokes are React elements, never lost) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ touchAction: "none" }}
        aria-hidden="true"
      >
        {strokes.map((s) => (
          <path
            key={s.id}
            d={pointsToPath(s.points)}
            stroke={s.color}
            strokeWidth={s.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path
          ref={livePathRef}
          d=""
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Snap hint indicator */}
      {snapHint && (
        <div
          className="absolute inset-x-0 flex items-center justify-center pointer-events-none"
          style={{ top: snapHint === "rotation" ? "44%" : "48%", zIndex: 50 }}
        >
          <div
            className="px-3 py-1 rounded-full text-xs font-semibold text-white"
            style={{ background: "oklch(var(--primary) / 0.85)" }}
          >
            {snapHint === "rotation" ? "Straightened" : "Centered"}
          </div>
        </div>
      )}

      {/* Text overlays */}
      {overlays.map((ov) => (
        <div
          key={ov.id}
          data-ocid={`snap.text.${ov.id}`}
          className="absolute select-none"
          style={{
            left: `${ov.x}%`,
            top: `${ov.y}%`,
            transform: `translate(-50%, -50%) rotate(${ov.rotation}deg) scale(${ov.scale})`,
            fontSize: ov.fontSize,
            fontFamily: ov.fontFamily,
            color: ov.color,
            fontWeight: "bold",
            textShadow: "0 0 8px rgba(0,0,0,0.8), 0 1px 3px rgba(0,0,0,0.9)",
            whiteSpace: "nowrap",
            cursor: "grab",
            touchAction: "none",
            pointerEvents: tool === "draw" ? "none" : "auto",
            zIndex: selectedId === ov.id ? 30 : 20,
            outline:
              selectedId === ov.id
                ? "2px solid oklch(var(--primary) / 0.8)"
                : "none",
            outlineOffset: "4px",
            borderRadius: 4,
            padding: "2px 6px",
          }}
          onTouchStart={(e) => handleOverlayTouchStart(e, ov.id)}
          onTouchMove={handleOverlayTouchMove}
          onTouchEnd={handleOverlayTouchEnd}
          onClick={(e) => {
            e.stopPropagation();
            if (editingId !== ov.id) setSelectedId(ov.id);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(ov.id);
            setEditingText(ov.text);
            setSelectedId(ov.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              if (editingId !== ov.id) setSelectedId(ov.id);
            }
          }}
        >
          {editingId === ov.id ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: snap text editor needs immediate focus on mobile
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={() => {
                if (editingText.trim()) {
                  setOverlays((prev) =>
                    prev.map((o) =>
                      o.id === ov.id ? { ...o, text: editingText.trim() } : o,
                    ),
                  );
                } else {
                  deleteOverlay(ov.id);
                }
                setEditingId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="bg-transparent border-none outline-none text-inherit font-inherit"
              style={{
                fontSize: ov.fontSize,
                color: ov.color,
                fontFamily: ov.fontFamily,
                fontWeight: "bold",
                width: `${Math.max(60, editingText.length * ov.fontSize * 0.6 + 16)}px`,
              }}
            />
          ) : (
            ov.text
          )}
        </div>
      ))}

      {/* Delete buttons for selected text */}
      {overlays.map((ov) =>
        selectedId === ov.id && editingId !== ov.id ? (
          <button
            key={`del-${ov.id}`}
            type="button"
            data-ocid={`snap.text.delete_button.${ov.id}`}
            onClick={(e) => {
              e.stopPropagation();
              deleteOverlay(ov.id);
            }}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${ov.x}%`,
              top: `${ov.y}%`,
              transform: `translate(calc(-50% + ${ov.text.length * ov.fontSize * 0.3 * ov.scale + 8}px), calc(-50% - ${ov.fontSize * 0.7 * ov.scale}px))`,
              width: 24,
              height: 24,
              background: "rgba(0,0,0,0.75)",
              border: "1.5px solid rgba(255,255,255,0.5)",
              zIndex: 40,
            }}
          >
            <X size={12} color="white" />
          </button>
        ) : null,
      )}

      {/* ─── TOP LEFT: Discard ──────────────────────────────────────────── */}
      <button
        type="button"
        data-ocid="snap.discard_button"
        onClick={onDiscard}
        className="absolute top-12 left-4 w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm"
        style={{ background: "rgba(0,0,0,0.55)", zIndex: 60 }}
        aria-label="Discard"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* ─── TOP RIGHT: Tool buttons ────────────────────────────────────── */}
      <div
        className="absolute top-12 right-4 flex flex-col gap-2"
        style={{ zIndex: 60 }}
      >
        <button
          type="button"
          data-ocid="snap.text_tool_button"
          onClick={() => setTool((t) => (t === "text" ? "none" : "text"))}
          className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
          style={{
            background:
              tool === "text" ? "oklch(var(--primary))" : "rgba(0,0,0,0.55)",
            border:
              tool === "text"
                ? "2px solid white"
                : "2px solid rgba(255,255,255,0.3)",
          }}
          aria-label="Add text"
        >
          <Type className="w-5 h-5 text-white" />
        </button>
        <button
          type="button"
          data-ocid="snap.draw_tool_button"
          onClick={() => setTool((t) => (t === "draw" ? "none" : "draw"))}
          className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
          style={{
            background:
              tool === "draw" ? "oklch(var(--primary))" : "rgba(0,0,0,0.55)",
            border:
              tool === "draw"
                ? "2px solid white"
                : "2px solid rgba(255,255,255,0.3)",
          }}
          aria-label="Draw"
        >
          <Pencil className="w-5 h-5 text-white" />
        </button>
        <button
          type="button"
          data-ocid="snap.overlays_tool_button"
          onClick={() =>
            setTool((t) => (t === "overlays" ? "none" : "overlays"))
          }
          className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all"
          style={{
            background:
              tool === "overlays" ? "oklch(var(--primary))" : "rgba(0,0,0,0.55)",
            border:
              tool === "overlays"
                ? "2px solid white"
                : "2px solid rgba(255,255,255,0.3)",
          }}
          aria-label="Overlays"
        >
          <Sticker className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* ─── BOTTOM: Tool panels ────────────────────────────────────────── */}
      {tool === "text" && (
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-4"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 70%, transparent)",
            zIndex: 60,
          }}
        >
          {/* Text input row */}
          <div className="flex gap-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddText()}
              placeholder="Type something…"
              className="flex-1 rounded-xl px-4 py-2.5 text-white text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "1px solid rgba(255,255,255,0.25)",
                fontFamily: textFont,
                fontSize: textSize > 36 ? 16 : textSize,
                color: textColor,
              }}
            />
            <button
              type="button"
              data-ocid="snap.add_text_button"
              onClick={handleAddText}
              disabled={!textInput.trim()}
              className="px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity disabled:opacity-40"
              style={{ background: "oklch(var(--primary))" }}
            >
              + Text
            </button>
          </div>

          {/* Color swatches */}
          <div className="flex gap-2 items-center">
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                data-ocid={`snap.text.color.${c.replace("#", "")}`}
                onClick={() => {
                  setTextColor(c);
                  // Update selected overlay color
                  if (selectedId)
                    setOverlays((prev) =>
                      prev.map((o) =>
                        o.id === selectedId ? { ...o, color: c } : o,
                      ),
                    );
                }}
                className="rounded-full transition-transform active:scale-90"
                style={{
                  width: textColor === c ? 34 : 28,
                  height: textColor === c ? 34 : 28,
                  background: c,
                  border:
                    textColor === c
                      ? "3px solid white"
                      : "2px solid rgba(255,255,255,0.4)",
                }}
                aria-label={c}
              />
            ))}
          </div>

          {/* Font options */}
          <div className="flex gap-2">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                data-ocid={`snap.text.font.${f.label.toLowerCase()}`}
                onClick={() => {
                  setTextFont(f.value);
                  if (selectedId)
                    setOverlays((prev) =>
                      prev.map((o) =>
                        o.id === selectedId ? { ...o, fontFamily: f.value } : o,
                      ),
                    );
                }}
                className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  background:
                    textFont === f.value
                      ? "oklch(var(--primary))"
                      : "rgba(255,255,255,0.15)",
                  color: "white",
                  fontFamily: f.value,
                  border:
                    textFont === f.value
                      ? "2px solid white"
                      : "1.5px solid rgba(255,255,255,0.25)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Font size slider */}
          <div className="flex items-center gap-3">
            <span className="text-white/60 text-xs">A</span>
            <input
              type="range"
              min={12}
              max={80}
              value={textSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setTextSize(size);
                if (selectedId)
                  setOverlays((prev) =>
                    prev.map((o) =>
                      o.id === selectedId ? { ...o, fontSize: size } : o,
                    ),
                  );
              }}
              data-ocid="snap.text.size_slider"
              className="flex-1 accent-blue-500"
            />
            <span className="text-white/60 text-xs">A</span>
          </div>
        </div>
      )}

      {tool === "draw" && (
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-4"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 70%, transparent)",
            zIndex: 60,
          }}
        >
          {/* Draw color row */}
          <div className="flex gap-2 items-center justify-center">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                data-ocid={`snap.draw.color.${c.replace("#", "")}`}
                onClick={() => setDrawColor(c)}
                className="rounded-full transition-transform active:scale-90"
                style={{
                  width: drawColor === c ? 34 : 28,
                  height: drawColor === c ? 34 : 28,
                  background: c,
                  border:
                    drawColor === c
                      ? "3px solid white"
                      : "2px solid rgba(255,255,255,0.4)",
                }}
                aria-label={c}
              />
            ))}
          </div>

          {/* Stroke width row */}
          <div className="flex gap-3 items-center justify-center">
            {STROKE_WIDTHS.map((sw) => (
              <button
                key={sw.value}
                type="button"
                data-ocid={`snap.draw.stroke.${sw.label.toLowerCase()}`}
                onClick={() => setStrokeWidth(sw.value)}
                className="flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 44,
                  height: 44,
                  background:
                    strokeWidth === sw.value
                      ? "oklch(var(--primary))"
                      : "rgba(255,255,255,0.15)",
                  border:
                    strokeWidth === sw.value
                      ? "2px solid white"
                      : "1.5px solid rgba(255,255,255,0.25)",
                }}
                aria-label={`Width ${sw.label}`}
              >
                <div
                  className="rounded-full"
                  style={{
                    width: sw.value * 2 + 4,
                    height: sw.value * 2 + 4,
                    background: drawColor,
                  }}
                />
              </button>
            ))}

            {/* Clear button */}
            <button
              type="button"
              data-ocid="snap.draw.clear_button"
              onClick={() => setStrokes([])}
              className="px-4 py-2 rounded-full text-sm font-medium text-white ml-2"
              style={{
                background: "rgba(255,60,60,0.35)",
                border: "1.5px solid rgba(255,100,100,0.5)",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ─── OVERLAYS PANEL ─────────────────────────────────────────────── */}
      {tool === "overlays" && (
        <div
          className="absolute bottom-0 left-0 right-0 flex flex-col gap-3 p-4"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.9) 75%, transparent)",
            zIndex: 60,
          }}
        >
          {/* Quick overlays */}
          <div className="flex gap-2">
            <button
              type="button"
              data-ocid="snap.overlay.time"
              onClick={addTimeOverlay}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-white text-sm font-semibold"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <Clock className="w-4 h-4" /> Time
            </button>
            <button
              type="button"
              data-ocid="snap.overlay.date"
              onClick={addDateOverlay}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-white text-sm font-semibold"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <CalendarDays className="w-4 h-4" /> Date
            </button>
            <button
              type="button"
              data-ocid="snap.overlay.location"
              onClick={addLocationOverlay}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-white text-sm font-semibold"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <MapPin className="w-4 h-4" /> Location
            </button>
          </div>

          {/* Stickers */}
          <span className="text-white/60 text-xs font-medium px-1">
            Stickers
          </span>
          <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1">
            {STICKERS.map((s, i) => (
              <button
                key={s}
                type="button"
                data-ocid={`snap.sticker.${i + 1}`}
                onClick={() => addOverlay(s, 64)}
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl active:scale-90 transition-transform"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── FILTER INDICATOR ───────────────────────────────────────────── */}
      {tool === "none" && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
          style={{ bottom: 92, zIndex: 55 }}
        >
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold text-white transition-opacity duration-300 ${
              filterFlash || filterIndex !== 0 ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: "rgba(0,0,0,0.5)" }}
          >
            {activeFilter.name}
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f, i) => (
              <span
                key={f.name}
                className="rounded-full transition-all"
                style={{
                  width: i === filterIndex ? 16 : 6,
                  height: 6,
                  background:
                    i === filterIndex ? "white" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── SEND BUTTON ────────────────────────────────────────────────── */}
      {tool === "none" && (
        <button
          type="button"
          data-ocid="snap.send_button"
          onClick={handleSend}
          className="absolute flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-white text-base"
          style={{
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background:
              "linear-gradient(135deg, oklch(var(--primary)), oklch(0.50 0.19 258))",
            boxShadow: "0 4px 24px oklch(var(--primary) / 0.4)",
            zIndex: 60,
          }}
        >
          <Send className="w-5 h-5" />
          Send
        </button>
      )}
    </div>
  );
}
