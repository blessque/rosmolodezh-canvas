import { useRef } from 'react';
import { clamp } from '@/utils/clamp';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (v: number) => string;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: SliderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pct = ((clamp(value, min, max) - min) / (max - min)) * 100;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-white/60">
        <span>{label}</span>
        <span className="font-mono">{formatValue ? formatValue(value) : value}</span>
      </div>
      <input
        ref={inputRef}
        type="range"
        className="custom-slider"
        style={{ '--fill': `${pct}%` } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
