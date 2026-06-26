import { useMemo } from "react";
import { useStore } from "../store";
import type { Item } from "../lib/api";
import { CodeIcon, DrawIcon, FolderIcon, PlusIcon, SearchIcon } from "./icons";

// Group items by folder for the tree. Root items come first under "".
function group(items: Item[]) {
  const byFolder = new Map<string, Item[]>();
  for (const it of items) {
    const arr = byFolder.get(it.folder) ?? [];
    arr.push(it);
    byFolder.set(it.folder, arr);
  }
  return byFolder;
}

export function Sidebar() {
  const { items, folders, activeId, setActive, setPalette } = useStore();
  const byFolder = useMemo(() => group(items), [items]);
  const allFolders = useMemo(() => {
    const set = new Set<string>(folders);
    items.forEach((i) => i.folder && set.add(i.folder));
    return [...set].sort();
  }, [folders, items]);

  const rootItems = byFolder.get("") ?? [];

  return (
    <aside
      className="flex h-full w-[264px] shrink-0 flex-col border-r border-[var(--edge-soft)]"
      style={{ background: "var(--panel)", backdropFilter: "blur(18px)" }}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className="mono text-[15px] font-semibold tracking-tight">scratchpad</span>
        <span className="caret" />
      </div>

      {/* Search / command launcher */}
      <button
        onClick={() => setPalette(true)}
        className="mx-3 mb-3 flex items-center gap-2 rounded-[10px] border border-[var(--edge-soft)] bg-[var(--paper-raised)] px-3 py-2 text-left text-sm text-[var(--ink-soft)] transition hover:border-[var(--edge)]"
      >
        <SearchIcon size={15} />
        <span className="flex-1">Search or create…</span>
        <kbd className="mono rounded border border-[var(--edge)] px-1.5 py-0.5 text-[10px] text-[var(--ink-faint)]">
          ⌘K
        </kbd>
      </button>

      {/* Tree */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {items.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-[var(--ink-faint)]">
            Nothing yet. Press ⌘K to start.
          </p>
        )}

        {rootItems.map((it) => (
          <ItemRow key={it.id} item={it} active={it.id === activeId} onClick={() => setActive(it.id)} />
        ))}

        {allFolders.map((folder) => (
          <div key={folder} className="mt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-[var(--ink-faint)]">
              <FolderIcon size={14} />
              <span className="mono truncate text-[11px] uppercase tracking-wider">{folder}</span>
            </div>
            {(byFolder.get(folder) ?? []).map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                active={it.id === activeId}
                onClick={() => setActive(it.id)}
                indent
              />
            ))}
          </div>
        ))}
      </nav>

      {/* New */}
      <div className="border-t border-[var(--edge-soft)] p-3">
        <button
          onClick={() => setPalette(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <PlusIcon size={16} /> New
        </button>
      </div>
    </aside>
  );
}

function ItemRow({
  item,
  active,
  onClick,
  indent,
}: {
  item: Item;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2 rounded-[8px] py-1.5 pr-2 text-left text-sm transition ${
        indent ? "pl-7" : "pl-3"
      } ${active ? "text-[var(--ink)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--paper-raised)]"}`}
      style={active ? { background: "var(--accent-soft)" } : undefined}
    >
      {/* Active ink bar — the hand-drawn accent */}
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      )}
      {item.type === "draw" ? (
        <DrawIcon size={15} className="shrink-0 opacity-80" />
      ) : (
        <CodeIcon size={15} className="shrink-0 opacity-80" />
      )}
      <span className="flex-1 truncate">{item.title}</span>
      {item.type === "code" && item.language && (
        <span className="mono text-[10px] text-[var(--ink-faint)]">{item.language}</span>
      )}
    </button>
  );
}
