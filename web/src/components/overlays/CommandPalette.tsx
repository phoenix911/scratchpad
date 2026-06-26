import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/store";
import { FileBadge } from "@/components/ui/FileBadge";
import { PlusIcon, DrawIcon, MindIcon, DocIcon, KanbanIcon, CornellIcon, SunIcon, MoonIcon } from "@/components/ui/icons";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

// ⌘K launcher: type to filter; create a snippet/drawing from the query, jump to
// a file, or toggle the theme. Clean card, gray hover, monospace.
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
    const title = q || "untitled";
    const list: Cmd[] = [
      {
        id: "new-code",
        label: q ? `New snippet “${q}”` : "New snippet",
        hint: "code",
        icon: <PlusIcon size={15} />,
        run: async () => void (await createItem("code", title)),
      },
      {
        id: "new-draw",
        label: q ? `New drawing “${q}”` : "New drawing",
        hint: "draw",
        icon: <DrawIcon size={15} />,
        run: async () => void (await createItem("draw", title)),
      },
      {
        id: "new-mind",
        label: q ? `New mindmap “${q}”` : "New mindmap",
        hint: "mind",
        icon: <MindIcon size={15} />,
        run: async () => void (await createItem("mind", title)),
      },
      {
        id: "new-doc",
        label: q ? `New doc “${q}”` : "New doc",
        hint: "doc",
        icon: <DocIcon size={15} />,
        run: async () => void (await createItem("doc", title)),
      },
      {
        id: "new-kanban",
        label: q ? `New board “${q}”` : "New board",
        hint: "kanban",
        icon: <KanbanIcon size={15} />,
        run: async () => void (await createItem("kanban", title)),
      },
      {
        id: "new-cornell",
        label: q ? `New Cornell note “${q}”` : "New Cornell note",
        hint: "cornell",
        icon: <CornellIcon size={15} />,
        run: async () => void (await createItem("cornell", title)),
      },
    ];
    for (const it of items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8)) {
      list.push({
        id: `open-${it.id}`,
        label: it.title,
        hint: it.folder || undefined,
        icon: <FileBadge itemType={it.type} language={it.language} />,
        run: () => setActive(it.id),
      });
    }
    if (!q) {
      list.push({
        id: "theme",
        label: theme === "dark" ? "Switch to light" : "Switch to dark",
        icon: theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />,
        run: () => toggleTheme(),
      });
    }
    return list;
  }, [query, items, theme, createItem, setActive, toggleTheme]);

  useEffect(() => setSel((s) => Math.min(s, Math.max(0, commands.length - 1))), [commands.length]);

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
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[16vh]"
      style={{ background: "rgba(0,0,0,0.32)" }}
      onClick={() => setPalette(false)}
    >
      <div
        className="pop-in w-full max-w-lg overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Search or create…"
          className="w-full border-b border-[var(--line)] bg-transparent px-4 py-3.5 text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
        />
        <ul className="max-h-[52vh] overflow-y-auto p-1.5">
          {commands.map((cmd, i) => (
            <li key={cmd.id}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => exec(cmd)}
                className={`flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left text-[13px] ${
                  i === sel ? "bg-[var(--hover)] text-[var(--ink)]" : "text-[var(--ink-soft)]"
                }`}
              >
                <span className="flex w-5 justify-center text-[var(--ink-soft)]">{cmd.icon}</span>
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint && (
                  <span className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">{cmd.hint}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
