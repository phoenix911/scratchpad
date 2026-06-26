import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { Item } from "../lib/api";
import { FileBadge } from "./FileBadge";
import { LanguageDropdown } from "./LanguageDropdown";
import { ShareDialog } from "./ShareDialog";
import { SyncPill } from "./SyncPill";
import {
  PlusIcon,
  SearchIcon,
  ChevronIcon,
  ChevronRightIcon,
  ShareIcon,
  TrashIcon,
  SunIcon,
  MoonIcon,
  PanelIcon,
} from "./icons";

function groupByFolder(items: Item[]) {
  const map = new Map<string, Item[]>();
  for (const it of items) {
    const arr = map.get(it.folder) ?? [];
    arr.push(it);
    map.set(it.folder, arr);
  }
  return map;
}

// Everything lives in the sidebar (no top bar): the file tree, the New action,
// the active file's inspector (title, language, share, delete), and the footer
// (sync + theme). Sits on the right; collapsible.
export function Sidebar() {
  const { items, folders, activeId, setActive, setPalette, theme, toggleTheme, toggleSidebar } = useStore();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const byFolder = useMemo(() => groupByFolder(items), [items]);
  const allFolders = useMemo(() => {
    const set = new Set<string>(folders);
    items.forEach((i) => i.folder && set.add(i.folder));
    return [...set].sort();
  }, [folders, items]);
  const rootItems = byFolder.get("") ?? [];

  function toggleFolder(f: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  }

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--sidebar)]">
      {/* Workspace header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          onClick={toggleSidebar}
          title="Collapse sidebar"
          className="rounded-[var(--radius)] p-1 text-[var(--ink-faint)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        >
          <PanelIcon size={16} />
        </button>
        <span className="text-[13px] font-semibold text-[var(--ink)]">scratchpad</span>
      </div>

      {/* Search + New */}
      <div className="flex flex-col gap-2 px-3 pb-2">
        <button
          onClick={() => setPalette(true)}
          className="flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-[13px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)]"
        >
          <SearchIcon size={14} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[11px] text-[var(--ink-faint)]">⌘K</kbd>
        </button>
        <button
          onClick={() => setPalette(true)}
          className="btn-brutal flex items-center justify-center gap-1.5 px-3 py-2 text-[13px]"
        >
          <PlusIcon size={16} /> New
        </button>
      </div>

      {/* Tree */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {items.length === 0 && (
          <p className="px-2 py-6 text-center text-[12px] text-[var(--ink-faint)]">
            No files yet. Press ⌘K.
          </p>
        )}
        {rootItems.map((it) => (
          <Row key={it.id} item={it} active={it.id === activeId} onClick={() => setActive(it.id)} />
        ))}
        {allFolders.map((folder) => {
          const open = !collapsedFolders.has(folder);
          return (
            <div key={folder} className="mt-1">
              <button
                onClick={() => toggleFolder(folder)}
                className="flex w-full items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--ink-faint)] transition hover:bg-[var(--hover)]"
              >
                {open ? <ChevronIcon size={12} /> : <ChevronRightIcon size={12} />}
                <span className="truncate">{folder}</span>
              </button>
              {open &&
                (byFolder.get(folder) ?? []).map((it) => (
                  <Row
                    key={it.id}
                    item={it}
                    active={it.id === activeId}
                    onClick={() => setActive(it.id)}
                    indent
                  />
                ))}
            </div>
          );
        })}
      </nav>

      <Inspector />

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-[var(--line)] px-3 py-2">
        <SyncPill />
        <div className="ml-auto" />
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className="rounded-[var(--radius)] p-1.5 text-[var(--ink-faint)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        >
          {theme === "dark" ? <SunIcon size={15} /> : <MoonIcon size={15} />}
        </button>
      </div>
    </aside>
  );
}

function Row({
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
      className={`flex w-full items-center gap-2 rounded-[var(--radius)] py-1.5 pr-2 text-left text-[13px] transition ${
        indent ? "pl-6" : "pl-2"
      } ${active ? "bg-[var(--active)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"}`}
    >
      <FileBadge itemType={item.type} language={item.language} />
      <span className="flex-1 truncate">{item.title}</span>
    </button>
  );
}

// The active file's controls — replaces the old top bar.
function Inspector() {
  const { items, activeId, updateMeta, deleteItem } = useStore();
  const item = items.find((i) => i.id === activeId);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) return null;

  return (
    <div className="border-t border-[var(--line)] px-3 py-2.5">
      <input
        key={item.id}
        defaultValue={item.title}
        onBlur={(e) => {
          const t = e.target.value.trim();
          if (t && t !== item.title) updateMeta(item.id, { title: t });
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="mb-2 w-full bg-transparent text-[14px] font-semibold text-[var(--ink)] outline-none"
        placeholder="Untitled"
      />

      {item.type === "code" && (
        <LanguageDropdown value={item.language} onChange={(lang) => updateMeta(item.id, { language: lang })} />
      )}

      <div className="mt-1.5 flex items-center gap-1">
        <button
          onClick={() => setShareOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-[var(--line)] px-2 py-1.5 text-[12px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        >
          <ShareIcon size={14} /> Share
        </button>
        {confirmDelete ? (
          <button
            onClick={() => deleteItem(item.id)}
            className="rounded-[var(--radius)] border border-[var(--danger)] px-2 py-1.5 text-[12px] font-medium text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
          >
            Delete?
          </button>
        ) : (
          <button
            onClick={() => {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }}
            title="Delete"
            className="rounded-[var(--radius)] border border-[var(--line)] p-1.5 text-[var(--ink-faint)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>

      {shareOpen && <ShareDialog itemId={item.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}
