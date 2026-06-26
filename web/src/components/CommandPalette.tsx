import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { CodeIcon, DrawIcon, PlusIcon, SunIcon, MoonIcon } from "./icons";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

// The ⌘K palette: a REPL-style launcher. Type to filter; a leading `›` prompt
// signals "give me a command". Create flows: when the query doesn't match an
// existing item, offer to create a snippet or drawing titled by the query.
export function CommandPalette() {
  const { paletteOpen, setPalette, items, setActive, createItem, toggleTheme, theme } = useStore();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setSel(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [paletteOpen]);

  const commands = useMemo<Cmd[]>(() => {
    const q = query.trim();
    const list: Cmd[] = [];

    const title = q || "untitled";
    list.push({
      id: "new-code",
      label: q ? `New snippet “${q}”` : "New snippet",
      hint: "code",
      icon: <CodeIcon size={16} />,
      run: async () => {
        await createItem("code", title);
      },
    });
    list.push({
      id: "new-draw",
      label: q ? `New drawing “${q}”` : "New drawing",
      hint: "draw",
      icon: <DrawIcon size={16} />,
      run: async () => {
        await createItem("draw", title);
      },
    });

    const matches = items.filter((it) => it.title.toLowerCase().includes(q.toLowerCase()));
    for (const it of matches.slice(0, 8)) {
      list.push({
        id: `open-${it.id}`,
        label: it.title,
        hint: it.folder || it.type,
        icon: it.type === "draw" ? <DrawIcon size={16} /> : <CodeIcon size={16} />,
        run: () => setActive(it.id),
      });
    }

    if (!q) {
      list.push({
        id: "theme",
        label: theme === "dark" ? "Switch to light" : "Switch to dark",
        icon: theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />,
        run: () => toggleTheme(),
      });
    }
    return list;
  }, [query, items, theme, createItem, setActive, toggleTheme]);

  useEffect(() => {
    setSel((s) => Math.min(s, Math.max(0, commands.length - 1)));
  }, [commands.length]);

  if (!paletteOpen) return null;

  async function exec(cmd: Cmd) {
    setPalette(false);
    await cmd.run();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => (s + 1) % commands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => (s - 1 + commands.length) % commands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (commands[sel]) exec(commands[sel]);
    } else if (e.key === "Escape") {
      setPalette(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[14vh]"
      style={{ background: "color-mix(in srgb, var(--paper) 55%, transparent)" }}
      onClick={() => setPalette(false)}
    >
      <div
        className="pop-in w-full max-w-xl overflow-hidden rounded-[16px] border border-[var(--edge)] shadow-2xl"
        style={{ background: "var(--panel)", backdropFilter: "blur(24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--edge-soft)] px-4">
          <span className="mono text-lg text-[var(--accent)]">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search or create…"
            className="mono w-full bg-transparent py-4 text-[15px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
          />
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2">
          {commands.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => exec(cmd)}
                className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm transition ${
                  i === sel ? "text-[var(--ink)]" : "text-[var(--ink-soft)]"
                }`}
                style={i === sel ? { background: "var(--accent-soft)" } : undefined}
              >
                <span className="text-[var(--ink-soft)]">
                  {cmd.id.startsWith("new") ? <PlusIcon size={16} /> : cmd.icon}
                </span>
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint && (
                  <span className="mono text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
                    {cmd.hint}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
