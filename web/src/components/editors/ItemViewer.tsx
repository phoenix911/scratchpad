import { lazy, Suspense } from "react";
import type { ItemType } from "@/lib/api";
import { CodeEditor } from "@/components/editors/CodeEditor";

const DrawCanvas = lazy(() => import("@/components/editors/DrawCanvas").then((m) => ({ default: m.DrawCanvas })));
const MindCanvas = lazy(() => import("@/components/editors/MindCanvas").then((m) => ({ default: m.MindCanvas })));
const TiptapEditor = lazy(() => import("@/components/editors/TiptapEditor").then((m) => ({ default: m.TiptapEditor })));
const KanbanBoard = lazy(() => import("@/components/editors/KanbanBoard").then((m) => ({ default: m.KanbanBoard })));
const CornellNote = lazy(() => import("@/components/editors/CornellNote").then((m) => ({ default: m.CornellNote })));
const StickyBoard = lazy(() => import("@/components/editors/StickyBoard").then((m) => ({ default: m.StickyBoard })));
const Outliner = lazy(() => import("@/components/editors/Outliner").then((m) => ({ default: m.Outliner })));

// Read-only render of any item type. Shared by the public share page and the
// version-history preview so they stay in sync.
export function ItemViewer({
  type,
  content,
  language,
  docId,
}: {
  type: ItemType;
  content: string;
  language?: string;
  docId: string;
}) {
  if (type === "code") {
    return (
      <CodeEditor docId={docId} initialContent={content} language={language || "text"} onChange={() => {}} readOnly />
    );
  }
  const fallback = <Centered>loading…</Centered>;
  if (type === "draw")
    return (
      <Suspense fallback={fallback}>
        <DrawCanvas docId={docId} initialContent={content} viewMode />
      </Suspense>
    );
  if (type === "mind")
    return (
      <Suspense fallback={fallback}>
        <MindCanvas docId={docId} initialContent={content} viewMode />
      </Suspense>
    );
  if (type === "doc")
    return (
      <Suspense fallback={fallback}>
        <TiptapEditor docId={docId} initialContent={content} readOnly />
      </Suspense>
    );
  if (type === "cornell")
    return (
      <Suspense fallback={fallback}>
        <CornellNote docId={docId} initialContent={content} readOnly />
      </Suspense>
    );
  if (type === "sticky")
    return (
      <Suspense fallback={fallback}>
        <StickyBoard docId={docId} initialContent={content} readOnly />
      </Suspense>
    );
  if (type === "wf")
    return (
      <Suspense fallback={fallback}>
        <Outliner docId={docId} initialContent={content} readOnly />
      </Suspense>
    );
  return (
    <Suspense fallback={fallback}>
      <KanbanBoard docId={docId} initialContent={content} readOnly />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center">
      <span className="text-[13px] text-[var(--ink-faint)]">{children}</span>
    </div>
  );
}
