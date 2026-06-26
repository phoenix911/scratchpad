import { lazy, Suspense, useEffect, useState } from "react";
import { useStore } from "@/store";
import { api, type FullItem } from "@/lib/api";
import { useDebouncedSave, type SaveState } from "@/lib/useDebouncedSave";
import { CodeEditor } from "@/components/editors/CodeEditor";

// Excalidraw + Mind Elixir are heavy — code-split so they load only when opened.
const DrawCanvas = lazy(() => import("@/components/editors/DrawCanvas").then((m) => ({ default: m.DrawCanvas })));
const MindCanvas = lazy(() => import("@/components/editors/MindCanvas").then((m) => ({ default: m.MindCanvas })));
const TiptapEditor = lazy(() => import("@/components/editors/TiptapEditor").then((m) => ({ default: m.TiptapEditor })));
const KanbanBoard = lazy(() => import("@/components/editors/KanbanBoard").then((m) => ({ default: m.KanbanBoard })));
const CornellNote = lazy(() => import("@/components/editors/CornellNote").then((m) => ({ default: m.CornellNote })));

// The main pane is just the editor/canvas, full-bleed — all controls live in the
// sidebar. A tiny unobtrusive save indicator floats in the corner.
export function Workspace() {
  const activeId = useStore((s) => s.activeId);
  const reloadNonce = useStore((s) => s.reloadNonce);
  const [item, setItem] = useState<FullItem | null>(null);
  const [loading, setLoading] = useState(false);

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
  }, [activeId, reloadNonce]);

  const { schedule, status } = useDebouncedSave<string>(async (content) => {
    if (!activeId) return;
    await api.updateItem(activeId, { content });
  });

  return (
    <div className="relative h-full min-w-0 flex-1 bg-[var(--page)]">
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
      {item && !loading && item.type === "mind" && (
        <Suspense fallback={<Centered>loading mindmap…</Centered>}>
          <MindCanvas docId={item.id} initialContent={item.content} onChange={schedule} />
        </Suspense>
      )}
      {item && !loading && item.type === "doc" && (
        <Suspense fallback={<Centered>loading…</Centered>}>
          <TiptapEditor docId={item.id} initialContent={item.content} onChange={schedule} />
        </Suspense>
      )}
      {item && !loading && item.type === "kanban" && (
        <Suspense fallback={<Centered>loading board…</Centered>}>
          <KanbanBoard docId={item.id} initialContent={item.content} onChange={schedule} />
        </Suspense>
      )}
      {item && !loading && item.type === "cornell" && (
        <Suspense fallback={<Centered>loading…</Centered>}>
          <CornellNote docId={item.id} initialContent={item.content} onChange={schedule} />
        </Suspense>
      )}
      <SaveBadge status={status} />
    </div>
  );
}

function SaveBadge({ status }: { status: SaveState }) {
  const text: Record<SaveState, string> = {
    idle: "",
    dirty: "editing",
    saving: "saving…",
    saved: "saved",
    error: "save failed",
  };
  if (!text[status]) return null;
  return (
    <span
      className="pointer-events-none fixed bottom-3 left-3 z-10 rounded-[var(--radius)] bg-[var(--raised)] px-2 py-1 text-[11px]"
      style={{ color: status === "error" ? "var(--danger)" : "var(--ink-faint)", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}
    >
      {text[status]}
    </span>
  );
}

function EmptyState() {
  const setPalette = useStore((s) => s.setPalette);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="text-[13px] text-[var(--ink-faint)]">Nothing open</div>
      <button
        onClick={() => setPalette(true)}
        className="btn-brutal px-4 py-2 text-[13px]"
      >
        Press ⌘K to create
      </button>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-[13px] text-[var(--ink-faint)]">{children}</span>
    </div>
  );
}
