import { useRef, useCallback } from "react";

interface SeamlessSliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (val: number) => void;
  label?: string;
  displayValue?: string | number;
  className?: string;
}

export function SeamlessSlider({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  displayValue,
  className = "",
}: SeamlessSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  // Normalize percentage for track fill (0 to 100%)
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const handlePointer = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const rawRatio = (clientX - rect.left) / rect.width;
      const clampedRatio = Math.max(0, Math.min(1, rawRatio));
      const rawValue = min + clampedRatio * (max - min);

      // Quantize to step
      const stepsCount = Math.round((rawValue - min) / step);
      const steppedValue = Math.min(max, Math.max(min, min + stepsCount * step));
      // Fix float rounding
      const precision = step.toString().split(".")[1]?.length || 0;
      const finalVal = parseFloat(steppedValue.toFixed(precision));

      onChange(finalVal);
    },
    [min, max, step, onChange],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handlePointer(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) {
      handlePointer(e.clientX);
    }
  };

  return (
    <div className={`seamless-slider-wrapper select-none ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-[11px] font-medium text-white/70 mb-1.5 px-0.5">
          <span className="truncate">{label}</span>
          <span className="font-mono text-white/90 text-xs">
            {displayValue !== undefined ? displayValue : value}
          </span>
        </div>
      )}

      {/* Touch & Click Track */}
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="relative h-6 flex items-center cursor-pointer group touch-none"
      >
        {/* Inactive Track Background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 group-hover:bg-white/15 transition-colors overflow-hidden">
          {/* Active Fill Bar */}
          <div
            className="h-full bg-gradient-to-r from-white/70 to-white rounded-full transition-[width] duration-75 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tactile Thumb Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6),0_0_10px_rgba(255,255,255,0.4)] border border-white/80 group-hover:scale-110 group-active:scale-125 transition-transform duration-100 ease-out"
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
