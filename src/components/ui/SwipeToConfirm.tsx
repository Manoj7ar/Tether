import { useRef, useState, useCallback, useEffect, type PointerEvent } from "react";
import { Loader2, ChevronRight } from "lucide-react";

interface SwipeToConfirmProps {
  onConfirm: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}

const THUMB_SIZE = 56;
const CONFIRM_THRESHOLD = 0.82;

export default function SwipeToConfirm({
  onConfirm,
  label = "Slide to Launch Mission",
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
    if (!loading && confirmed) setConfirmed(false);
  }, [loading, confirmed]);

  const getMax = useCallback(() => {
    if (!trackRef.current) return 200;
    return trackRef.current.offsetWidth - THUMB_SIZE - 8;
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
    const ratio = offset / maxRef.current;
    if (ratio >= CONFIRM_THRESHOLD) {
      setOffset(maxRef.current);
      setConfirmed(true);
      onConfirm();
    } else {
      setOffset(0);
    }
  }, [dragging, offset, onConfirm]);

  const progress = maxRef.current > 0 ? offset / maxRef.current : 0;

  return (
    <div
      ref={trackRef}
      className={`relative h-16 rounded-full select-none overflow-hidden transition-colors ${
        disabled ? "bg-muted opacity-50 pointer-events-none" : "bg-primary/10"
      }`}
    >
      <div
        className="absolute inset-0 rounded-full bg-primary/20 origin-left transition-transform"
        style={{ transform: `scaleX(${progress})` }}
      />

      <span
        className="absolute inset-0 flex items-center justify-center text-sm font-medium text-primary pointer-events-none transition-opacity"
        style={{ opacity: Math.max(0, 1 - progress * 2.5) }}
      >
        {loading ? "Launching..." : label}
        {!loading && (
          <ChevronRight className="h-4 w-4 ml-1 animate-pulse" />
        )}
      </span>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute top-1 left-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg cursor-grab active:cursor-grabbing touch-none ${
          !dragging && !confirmed ? "transition-transform duration-300" : ""
        }`}
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE - 8,
          transform: `translateX(${offset}px)`,
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : confirmed ? (
          <span className="text-lg font-bold">✓</span>
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </div>
    </div>
  );
}
