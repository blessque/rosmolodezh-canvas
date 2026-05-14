import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';

const SIZES = [
  { label: '4:5',    w: 1080, h: 1350 },
  { label: '16:9',   w: 1920, h: 1080 },
  { label: '9:16',   w: 1080, h: 1920 },
  { label: 'A3 P',   w: 1240, h: 1754 },
  { label: 'A3 L',   w: 1754, h: 1240 },
  { label: '1:1',    w: 1080, h: 1080 },
] as const;

function radius(i: number, total: number) {
  if (total === 1) return 'rounded-[8px]';
  if (i === 0) return 'rounded-tl-[8px] rounded-tr-[8px] rounded-bl-[2px] rounded-br-[2px]';
  if (i === total - 1) return 'rounded-bl-[8px] rounded-br-[8px] rounded-tl-[2px] rounded-tr-[2px]';
  return 'rounded-[2px]';
}

export function CanvasSizeSelector() {
  const viewport = useUIStore((s) => s.viewport);
  const setDocumentSize = useUIStore((s) => s.setDocumentSize);
  const pushHistory = useSceneStore((s) => s.pushHistory);

  return (
    <div className="flex flex-col gap-[2px]">
      {SIZES.map(({ label, w, h }, i) => {
        const active = viewport.documentWidth === w && viewport.documentHeight === h;
        return (
          <button
            key={label}
            onClick={() => {
            pushHistory(useUIStore.getState().captureSnapshot());
            setDocumentSize(w, h);
          }}
            className={[
              'flex items-center justify-between p-[10px] transition-colors',
              radius(i, SIZES.length),
              active
                ? 'bg-white text-[#0e0f11]'
                : 'bg-[#ECEEF3] text-[#6B7280] hover:bg-[#E0E2E8] hover:text-[#0e0f11]',
            ].join(' ')}
          >
            <span className="font-mono text-[14px] shrink-0">{label}</span>
            <span className="font-mono text-[14px] opacity-50 shrink-0">{w}×{h}</span>
          </button>
        );
      })}
    </div>
  );
}
