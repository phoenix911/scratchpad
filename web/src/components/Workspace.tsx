import { lazy, Suspense, useEffect, useState } from "react";
import { useStore } from "../store";
import { api, type FullItem } from "../lib/api";
import { useDebouncedSave, type SaveState } from "../lib/useDebouncedSave";
import { CodeEditor } from "./CodeEditor";
import { ShareDialog } from "./ShareDialog";
import { SyncPill } from "./SyncPill";
import { LANGS } from "../lib/langs";
import { SunIcon, MoonIcon, TrashIcon, ShareIcon } from "./icons";

// Excalidraw is heavy — code-split it so code-only sessions never download it.
const DrawCanvas = lazy(() =>
  import("./DrawCanvas").then((m) => ({ default: m.DrawCanvas })),
);

export function Workspace() {
  const { activeId, theme, toggleTheme, deleteItem, refresh } = useStore();
  const [item, setItem] = useState<FullItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-reset the delete confirmation if the user doesn't act.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 3000);
    return () => clearTimeout(t);
  }, [confirmDelete]);
  useEffect(() => setConfirmDelete(false), [activeId]);

  // Load the active item's content whenever the selection changes.
  useEffect(() => {
    if (!activeId) {
      setItem(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .getItem(activeId)
      .then((fi) => alive && setItem(fi))
      .catch(() => alive && setItem(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [activeId]);

  const { schedule, status } = useDebouncedSave<string>(async (content) => {
    if (!activeId) return;
    await api.updateItem(activeId, { content });
  });

  async function setLanguage(language: string) {
    if (!item) return;
    const updated = await api.updateItem(item.id, { language });
    setItem({ ...item, language: updated.language, path: updated.path });
    refresh();
  }

  async function setTitle(title: string) {
    if (!item || title.trim() === item.title) return;
    const updated = await api.updateItem(item.id, { title });
    setItem({ ...item, title: updated.title, path: updated.path });
    refresh();
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--edge-soft)] px-5">
        {item ? (
          <>
            {item.folder && (
              <span className="mono truncate text-xs text-[var(--ink-faint)]">{item.folder} /</span>
            )}
            <input
              key={item.id}
              defaultValue={item.title}
              onBlur={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[var(--ink)] outline-none"
            />
            {item.type === "code" && (
              <select
                value={item.language}
                onChange={(e) => setLanguage(e.target.value)}
                className="mono rounded-md border border-[var(--edge-soft)] bg-[var(--paper-raised)] px-2 py-1 text-xs text-[var(--ink-soft)] outline-none"
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            )}
            <SaveBadge status={status} />
            <button
              title="Share a view-only link"
              onClick={() => setShareOpen(true)}
              className="rounded-md p-1.5 text-[var(--ink-faint)] transition hover:text-[var(--ink)]"
            >
              <ShareIcon size={16} />
            </button>
            {confirmDelete ? (
              <button
                onClick={() => deleteItem(item.id)}
                className="mono rounded-md border border-[var(--danger)] px-2 py-1 text-[11px] text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
              >
                delete?
              </button>
            ) : (
              <button
                title="Delete"
                onClick={() => setConfirmDelete(true)}
                className="rounded-md p-1.5 text-[var(--ink-faint)] transition hover:text-[var(--danger)]"
              >
                <TrashIcon size={16} />
              </button>
            )}
          </>
        ) : (
          <span className="mono text-xs text-[var(--ink-faint)]">no document</span>
        )}

        <div className="ml-auto" />
        <SyncPill />
        <button
          onClick={toggleTheme}
          title="Toggle theme"
          className="rounded-md p-1.5 text-[var(--ink-faint)] transition hover:text-[var(--ink)]"
        >
          {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
      </header>

      <div className="min-h-0 flex-1">
        {!activeId && <EmptyState />}
        {activeId && loading && <Centered>opening…</Centered>}
        {item && !loading && item.type === "code" && (
          <CodeEditor
            docId={item.id}
            initialContent={item.content}
            language={item.language}
            onChange={schedule}
          />
        )}
        {item && !loading && item.type === "draw" && (
          <Suspense fallback={<Centered>loading canvas…</Centered>}>
            <DrawCanvas docId={item.id} initialContent={item.content} onChange={schedule} />
          </Suspense>
        )}
      </div>

      {shareOpen && item && <ShareDialog itemId={item.id} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function SaveBadge({ status }: { status: SaveState }) {
  const map: Record<SaveState, { text: string; color: string }> = {
    idle: { text: "", color: "" },
    dirty: { text: "editing", color: "var(--ink-faint)" },
    saving: { text: "saving…", color: "var(--ink-soft)" },
    saved: { text: "saved", color: "var(--ink-faint)" },
    error: { text: "save failed", color: "var(--danger)" },
  };
  const s = map[status];
  if (!s.text) return null;
  return (
    <span className="mono text-[11px]" style={{ color: s.color }}>
      {s.text}
    </span>
  );
}

function EmptyState() {
  const setPalette = useStore((s) => s.setPalette);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="mono text-sm text-[var(--ink-faint)]">a blank page</div>
      <button
        onClick={() => setPalette(true)}
        className="rounded-[var(--radius)] border border-[var(--edge)] bg-[var(--paper-raised)] px-4 py-2.5 text-sm text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
      >
        Press <kbd className="mono text-[var(--accent)]">⌘K</kbd> to write or draw something
      </button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="mono text-sm text-[var(--ink-faint)]">{children}</span>
    </div>
  );
}
