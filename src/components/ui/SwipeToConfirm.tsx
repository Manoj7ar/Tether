import { useRef, useState, useCallback, useEffect, type PointerEvent } from "react";
import { Loader2, ChevronRight, Check } from "lucide-react";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  label?: string;
  confirmedLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}

const THUMB_SIZE = 52;
const TRACK_PAD = 4;
const CONFIRM_THRESHOLD = 0.85;

export default function SwipeToConfirm({
  onConfirm,
  label = "Slide to Launch Mission",
  confirmedLabel = "Approved",
  loading = false,
  disabled = false,
}: SwipeToConfirmProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startXRef = useRef(0);
  const maxRef = useRef(0);

  useEffect(() => {
    if (!loading && confirmed) {
      const t = setTimeout(() => setConfirmed(false), 1800);
      return () => clearTimeout(t);
    }
  }, [loading, confirmed]);

  const getMax = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - THUMB_SIZE - TRACK_PAD * 2;
  }, []);

  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (loading || disabled || confirmed) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      startXRef.current = e.clientX;
      maxRef.current = getMax();
      setDragging(true);
    },
    [loading, disabled, confirmed, getMax],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const dx = e.clientX - startXRef.current;
      setOffset(Math.max(0, Math.min(dx, maxRef.current)));
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const ratio = maxRef.current > 0 ? offset / maxRef.current : 0;
    if (ratio >= CONFIRM_THRESHOLD) {
      setOffset(maxRef.current);
      setConfirmed(true);
      onConfirm();
    } else {
      setOffset(0);
    }
  }, [dragging, offset, onConfirm]);

  const progress = maxRef.current > 0 ? offset / maxRef.current : 0;

  const trackBg = confirmed
    ? "bg-emerald-500/20 border-emerald-500/40"
    : disabled
      ? "bg-muted border-border opacity-50 pointer-events-none"
      : "bg-primary/10 border-primary/20";

  const fillBg = confirmed ? "bg-emerald-500/30" : "bg-primary/20";

  const thumbBg = confirmed
    ? "bg-emerald-500 text-white"
    : "bg-primary text-primary-foreground";

  return (
    <div
      ref={trackRef}
      className={`relative h-14 rounded-2xl select-none overflow-hidden border transition-all duration-500 ${trackBg}`}
    >
      {/* Progress fill */}
      <div
        className={`absolute inset-y-0 left-0 rounded-2xl transition-all ${
          dragging ? "duration-0" : "duration-300 ease-out"
        } ${fillBg}`}
        style={{ width: `${Math.max(0, (offset + THUMB_SIZE + TRACK_PAD) / (trackRef.current?.offsetWidth || 1) * 100)}%` }}
      />

      {/* Label text (fades out as you drag) */}
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-medium pointer-events-none transition-all duration-300 ${
          confirmed ? "text-emerald-600 dark:text-emerald-400" : "text-primary"
        }`}
        style={{ opacity: confirmed ? 1 : Math.max(0, 1 - progress * 2) }}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Launching...
          </>
        ) : confirmed ? (
          <>
            <Check className="h-4 w-4 mr-1.5" />
            {confirmedLabel}
          </>
        ) : (
          <>
            {label}
            <ChevronRight className="h-4 w-4 ml-1 animate-[pulse_1.5s_ease-in-out_infinite]" />
          </>
        )}
      </span>

      {/* Draggable thumb */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute flex items-center justify-center rounded-xl shadow-md cursor-grab active:cursor-grabbing touch-none transition-all ${
          dragging ? "duration-0 scale-105" : "duration-300 ease-out"
        } ${confirmed ? "scale-100" : ""} ${thumbBg}`}
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE - 8,
          top: TRACK_PAD,
          left: TRACK_PAD,
          transform: `translateX(${offset}px)`,
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : confirmed ? (
          <Check className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </div>
    </div>
  );
}
