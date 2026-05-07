import { useUIStore, type AppMode } from '@/store/uiStore';

const TABS: { id: AppMode; label: string }[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'stamp', label: 'Stamp' },
];

export function ModeTabBar() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);

  return (
    <div className="flex gap-[2px] rounded-[8px] bg-[#202226] p-[3px]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setMode(tab.id)}
          className={[
            'flex-1 rounded-[6px] px-4 py-[6px] text-sm font-medium transition-colors',
            mode === tab.id
              ? 'bg-[#33373f] text-white'
              : 'text-white/50 hover:text-white/80',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
