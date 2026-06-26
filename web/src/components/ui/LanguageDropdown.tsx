import { useEffect, useRef, useState } from "react";
import { LANGUAGES, FILE_TYPES } from "@/lib/filetypes";
import { FileBadge } from "@/components/ui/FileBadge";
import { CheckIcon, ChevronIcon } from "@/components/ui/icons";

// A modern popover dropdown for picking a code snippet's language. Keyboard
// navigable, click-outside to close. Each option shows its extension badge.
export function LanguageDropdown({
  value,
  onChange,
}: {
  value: string;
  onChange: (lang: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, LANGUAGES.indexOf(value as (typeof LANGUAGES)[number])));
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, value]);

  function choose(lang: string) {
    onChange(lang);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => (h + 1) % LANGUAGES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => (h - 1 + LANGUAGES.length) % LANGUAGES.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(LANGUAGES[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const current = FILE_TYPES[value]?.label ?? value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className="flex w-full items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-[13px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)]"
      >
        <FileBadge itemType="code" language={value} />
        <span className="flex-1 truncate text-left text-[var(--ink)]">{current}</span>
        <ChevronIcon size={14} className={`transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="pop-in absolute bottom-full left-0 z-30 mb-1 max-h-72 w-full min-w-[180px] overflow-y-auto rounded-[8px] border border-[var(--line)] bg-[var(--raised)] p-1 shadow-lg"
          onKeyDown={onKey}
        >
          {LANGUAGES.map((lang, i) => (
            <button
              key={lang}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(lang)}
              className={`flex w-full items-center gap-2 rounded-[5px] px-2 py-1.5 text-left text-[13px] transition ${
                i === hi ? "bg-[var(--hover)]" : ""
              }`}
            >
              <FileBadge itemType="code" language={lang} />
              <span className="flex-1 truncate text-[var(--ink)]">{FILE_TYPES[lang].label}</span>
              {lang === value && <CheckIcon size={14} className="text-[var(--accent)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
