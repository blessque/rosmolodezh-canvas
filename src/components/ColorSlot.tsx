import { useEffect, useRef, useState } from 'react';

export function ColorSlot({
  label,
  color,
  onChange,
  initialHistory,
}: {
  label: string;
  color: string;
  onChange: (c: string) => void;
  initialHistory?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const colorOnOpenRef = useRef<string>(color);
  const [history, setHistory] = useState<string[]>(initialHistory ?? []);
  const [editing, setEditing] = useState(false);
  const [draftHex, setDraftHex] = useState('');
  const hexInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      hexInputRef.current?.focus();
      hexInputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleCommit = () => {
      const prev = colorOnOpenRef.current;
      if (input.value !== prev) {
        setHistory((h) => [prev, ...h.filter((x) => x !== prev)].slice(0, 5));
      }
    };
    input.addEventListener('change', handleCommit);
    return () => input.removeEventListener('change', handleCommit);
  }, []);

  function handleOpen() {
    colorOnOpenRef.current = color;
    inputRef.current?.click();
  }

  function commitHex() {
    setEditing(false);
    const val = draftHex.trim();
    if (/^[0-9A-F]{6}$/i.test(val)) {
      const newColor = '#' + val;
      if (newColor.toLowerCase() !== color.toLowerCase()) {
        setHistory((h) => [color, ...h.filter((x) => x !== color)].slice(0, 5));
      }
      onChange(newColor);
    }
  }

  const hex = color.replace('#', '').toUpperCase();

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="bg-[#ECEEF3] rounded-[8px] pl-[3px] pr-[6px] py-[3px] flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-[5px] shrink-0 border border-black/10 cursor-pointer"
          style={{ backgroundColor: color }}
          onClick={handleOpen}
        />
        <span className="font-cond-regular text-[14px] text-[#0e0f11] flex-1 cursor-pointer" onClick={handleOpen}>{label}</span>
        {editing ? (
          <input
            ref={hexInputRef}
            type="text"
            value={draftHex}
            maxLength={6}
            spellCheck={false}
            onChange={(e) => setDraftHex(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHex();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={commitHex}
            className="font-mono-book text-[14px] text-[#0e0f11] uppercase bg-transparent border-none outline-none caret-[#0e0f11] w-[6ch] p-0"
          />
        ) : (
          <span
            className="font-mono-book text-[14px] text-[#6B7280] uppercase cursor-text select-none"
            onClick={() => { setDraftHex(hex); setEditing(true); }}
          >
            {hex}
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      {history.length > 0 && (
        <div className="flex gap-[2px] flex-wrap">
          {history.map((c) => (
            <button
              key={c}
              onClick={() => {
                setHistory((h) => h.map((x) => x === c ? color : x));
                onChange(c);
              }}
              className="w-4 h-4 rounded-[5px] border border-black/[0.08] cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
