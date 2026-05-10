import { useUIStore, type AppMode } from '@/store/uiStore';

const TABS: { id: AppMode; label: string }[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'stamp', label: 'Stamp' },
];

export function ModeTabBar() {
  const mode = useUIStore((s) => s.mode);
  const setMode = useUIStore((s) => s.setMode);

  return (
    <div className="flex gap-[2px] rounded-[8px] bg-[#E5E7EC] p-[3px]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setMode(tab.id)}
          className={[
            'flex-1 rounded-[6px] px-4 py-[6px] font-cond-regular text-[14px] transition-colors',
            mode === tab.id
              ? 'bg-white text-[#0e0f11]'
              : 'text-[#6B7280] hover:text-[#0e0f11]',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
