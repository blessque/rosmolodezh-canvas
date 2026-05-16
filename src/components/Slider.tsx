import { useEffect, useRef, useState } from 'react';

const THUMB_SIZE = 10;
const THUMB_OVERHANG = 0;
const TRACK_PAD = 3;

function stepPct(v: number, min: number, max: number, trackWidth: number): number {
  const fraction = (v - min) / (max - min);
  return ((TRACK_PAD + THUMB_SIZE / 2 + fraction * (trackWidth - 2 * TRACK_PAD - THUMB_SIZE)) / trackWidth) * 100;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  showDots,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  showDots?: boolean;
  onChange: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackWidth(el.offsetWidth));
    ro.observe(el);
    setTrackWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const rawFraction = (value - min) / (max - min);
  const fillEndPct = trackWidth > 0
    ? ((TRACK_PAD + THUMB_SIZE / 2 + rawFraction * (trackWidth - 2 * TRACK_PAD - THUMB_SIZE) + THUMB_OVERHANG) / trackWidth) * 100
    : rawFraction * 100;

  const dotValues = showDots && trackWidth > 0
    ? Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step).filter((v) => v > value)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline px-0.5">
        <span className="font-cond-regular text-[14px] text-[#6B7280] uppercase leading-none">{label}</span>
        <span className="font-mono-book text-[14px] text-[#0e0f11] leading-none">{displayValue ?? value}</span>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="custom-slider block"
          style={{ '--fill': `${fillEndPct}%` } as React.CSSProperties}
        />
        {dotValues.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {dotValues.map((v) => (
              <div
                key={v}
                className="absolute rounded-full bg-[#9CA3B1]"
                style={{
                  left: `${stepPct(v, min, max, trackWidth)}%`,
                  top: '50%',
                  width: 3,
                  height: 3,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
