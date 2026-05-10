import { useState } from 'react';
import { Slider } from '@/components/Slider';
import type { GenerateOpts, DistortionMode } from '@/modes/generator/GeneratorEngine';
import type { TopStyle } from '@/types/scene';

interface DevPanelProps {
  onChange: (opts: GenerateOpts) => void;
}

interface DevState {
  mode: DistortionMode;
  rectCount: 2 | 3;
  relation: 'same' | 'opposite';
  topStyle0: TopStyle;
  topStyle1: TopStyle;
  topStyle2: TopStyle;
  rotation0: number;
  rotation1: number;
  rotation2: number;
  baseMag: number;
  sizeRatio: number;
  cornerRadiusMult: number;
  overlapFrac: number;
  staggerFrac: number;
  bottomRight0: number;
  bottomLeft0: number;
  bottomRight1: number;
  bottomLeft1: number;
  bottomRight2: number;
  bottomLeft2: number;
}

const DEFAULTS: DevState = {
  mode: 'lean-right',
  rectCount: 2,
  relation: 'same',
  topStyle0: 'angled',
  topStyle1: 'angled',
  topStyle2: 'angled',
  rotation0: 0,
  rotation1: 0,
  rotation2: 0,
  baseMag: 0.30,
  sizeRatio: 0.72,
  cornerRadiusMult: 0.02,
  overlapFrac: 0.10,
  staggerFrac: 0.10,
  bottomRight0: 0,
  bottomLeft0: 0,
  bottomRight1: 0,
  bottomLeft1: 0,
  bottomRight2: 0,
  bottomLeft2: 0,
};

function stateToOpts(s: DevState): GenerateOpts {
  return {
    forcedMode: s.mode,
    rectCount: s.rectCount,
    relation: s.relation,
    topStyle0: s.topStyle0,
    topStyle1: s.topStyle1,
    topStyle2: s.topStyle2,
    rotation0: s.rotation0,
    rotation1: s.rotation1,
    rotation2: s.rotation2,
    baseMag: s.baseMag,
    sizeRatio: s.sizeRatio,
    cornerRadiusMult: s.cornerRadiusMult,
    overlapFrac: s.overlapFrac,
    staggerFrac: s.staggerFrac,
    bottomRight0: s.bottomRight0,
    bottomLeft0: s.bottomLeft0,
    bottomRight1: s.bottomRight1,
    bottomLeft1: s.bottomLeft1,
    bottomRight2: s.bottomRight2,
    bottomLeft2: s.bottomLeft2,
  };
}

export function DevPanel({ onChange }: DevPanelProps) {
  const [s, setS] = useState<DevState>(DEFAULTS);

  function update(patch: Partial<DevState>) {
    const next = { ...s, ...patch };
    setS(next);
    onChange(stateToOpts(next));
  }

  const isRightAnchor = s.mode === 'right-anchor';
  const show3 = s.rectCount === 3;

  function BtnGroup({
    label, value, options, onSelect, disabled,
  }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (v: string) => void;
    disabled?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        <div className="flex gap-1 flex-wrap">
          {options.map((opt) => (
            <button
              key={opt}
              disabled={disabled}
              onClick={() => onSelect(opt)}
              className={[
                'px-2 py-1 rounded text-xs transition-colors',
                value === opt
                  ? 'bg-white text-black font-medium'
                  : 'bg-white/10 text-white/60 hover:bg-white/20',
                disabled ? 'opacity-30 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-xs">

      {/* ── Shape type ─────────────────────────────────────── */}
      <p className="text-white/40 uppercase tracking-wider font-medium">Shape type</p>

      <BtnGroup
        label="Mode"
        value={s.mode}
        options={['lean-right', 'lean-left', 'both-deep', 'right-anchor']}
        onSelect={(v) => update({ mode: v as DistortionMode, relation: v === 'right-anchor' ? 'same' : s.relation })}
      />
      <BtnGroup
        label="Rect count"
        value={String(s.rectCount)}
        options={['2', '3']}
        onSelect={(v) => update({ rectCount: Number(v) as 2 | 3 })}
      />
      <BtnGroup
        label="Relation"
        value={s.relation}
        options={['same', 'opposite']}
        onSelect={(v) => update({ relation: v as 'same' | 'opposite' })}
        disabled={isRightAnchor}
      />

      {/* ── Size & layout ──────────────────────────────────── */}
      <p className="text-white/40 uppercase tracking-wider font-medium mt-2">Size & layout</p>

      <Slider label="Distortion depth" value={s.baseMag} min={0.10} max={0.55} step={0.01}
        onChange={(v) => update({ baseMag: v })} formatValue={(v) => v.toFixed(2)} />
      <Slider label="Size ratio" value={s.sizeRatio} min={0.45} max={0.95} step={0.01}
        onChange={(v) => update({ sizeRatio: v })} formatValue={(v) => v.toFixed(2)} />
      <Slider label="Corner radius" value={s.cornerRadiusMult} min={0.005} max={0.06} step={0.005}
        onChange={(v) => update({ cornerRadiusMult: v })} formatValue={(v) => v.toFixed(3)} />
      <Slider label="Overlap" value={s.overlapFrac} min={0.04} max={0.72} step={0.01}
        onChange={(v) => update({ overlapFrac: v })} formatValue={(v) => v.toFixed(2)} />
      <Slider label="Stagger" value={s.staggerFrac} min={0.02} max={0.25} step={0.01}
        onChange={(v) => update({ staggerFrac: v })} formatValue={(v) => v.toFixed(2)} />

      {/* ── Rect 0 ─────────────────────────────────────────── */}
      <p className="text-white/40 uppercase tracking-wider font-medium mt-2">Rect 0</p>
      <BtnGroup label="Top style" value={s.topStyle0} options={['flat', 'angled']}
        onSelect={(v) => update({ topStyle0: v as TopStyle })} disabled={isRightAnchor} />
      <Slider label="Rotation" value={s.rotation0} min={-12} max={12} step={0.5}
        onChange={(v) => update({ rotation0: v })} formatValue={(v) => `${v}°`} />
      <Slider label="Bottom-right offset" value={s.bottomRight0} min={-0.25} max={0.55} step={0.01}
        onChange={(v) => update({ bottomRight0: v })} formatValue={(v) => v.toFixed(2)} />
      <Slider label="Bottom-left offset" value={s.bottomLeft0} min={0} max={0.20} step={0.01}
        onChange={(v) => update({ bottomLeft0: v })} formatValue={(v) => v.toFixed(2)} />

      {/* ── Rect 1 ─────────────────────────────────────────── */}
      <p className="text-white/40 uppercase tracking-wider font-medium mt-2">Rect 1</p>
      <BtnGroup label="Top style" value={s.topStyle1} options={['flat', 'angled']}
        onSelect={(v) => update({ topStyle1: v as TopStyle })} disabled={isRightAnchor} />
      <Slider label="Rotation" value={s.rotation1} min={-12} max={12} step={0.5}
        onChange={(v) => update({ rotation1: v })} formatValue={(v) => `${v}°`} />
      <Slider label="Bottom-right offset" value={s.bottomRight1} min={-0.25} max={0.55} step={0.01}
        onChange={(v) => update({ bottomRight1: v })} formatValue={(v) => v.toFixed(2)} />
      <Slider label="Bottom-left offset" value={s.bottomLeft1} min={0} max={0.20} step={0.01}
        onChange={(v) => update({ bottomLeft1: v })} formatValue={(v) => v.toFixed(2)} />

      {/* ── Rect 2 (3-rect only) ──────────────────────────── */}
      {show3 && (
        <>
          <p className="text-white/40 uppercase tracking-wider font-medium mt-2">Rect 2</p>
          <BtnGroup label="Top style" value={s.topStyle2} options={['flat', 'angled']}
            onSelect={(v) => update({ topStyle2: v as TopStyle })} disabled={isRightAnchor} />
          <Slider label="Rotation" value={s.rotation2} min={-12} max={12} step={0.5}
            onChange={(v) => update({ rotation2: v })} formatValue={(v) => `${v}°`} />
          <Slider label="Bottom-right offset" value={s.bottomRight2} min={-0.25} max={0.55} step={0.01}
            onChange={(v) => update({ bottomRight2: v })} formatValue={(v) => v.toFixed(2)} />
          <Slider label="Bottom-left offset" value={s.bottomLeft2} min={0} max={0.20} step={0.01}
            onChange={(v) => update({ bottomLeft2: v })} formatValue={(v) => v.toFixed(2)} />
        </>
      )}
    </div>
  );
}
