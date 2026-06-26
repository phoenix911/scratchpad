import { lazy, Suspense, useEffect, useState } from "react";
import { api, type SharedView } from "../lib/api";
import { ApiError } from "../lib/api";
import { CodeEditor } from "./CodeEditor";

const DrawCanvas = lazy(() => import("./DrawCanvas").then((m) => ({ default: m.DrawCanvas })));
const MindCanvas = lazy(() => import("./MindCanvas").then((m) => ({ default: m.MindCanvas })));

type State = { kind: "loading" } | { kind: "ok"; view: SharedView } | { kind: "error"; message: string };

// The public, read-only page rendered at /s/:token. No app chrome, no auth.
export function ShareView({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    api
      .getShared(token)
      .then((view) => setState({ kind: "ok", view }))
      .catch((err) => {
        const message =
          err instanceof ApiError && err.status === 410
            ? "This link has expired."
            : "This link isn’t available.";
        setState({ kind: "error", message });
      });
  }, [token]);

  if (state.kind === "loading") {
    return <Centered>opening…</Centered>;
  }
  if (state.kind === "error") {
    return (
      <Centered>
        <div className="text-center">
          <div className="mono mb-2 text-[var(--ink)]">{state.message}</div>
          <div className="text-xs text-[var(--ink-faint)]">Ask the owner for a fresh link.</div>
        </div>
      </Centered>
    );
  }

  const { view } = state;
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--edge-soft)] px-5">
        <span className="mono text-sm font-semibold tracking-tight">scratchpad</span>
        <span className="text-[var(--ink-faint)]">/</span>
        <span className="truncate text-sm text-[var(--ink)]">{view.title}</span>
        <span className="mono ml-auto rounded-md border border-[var(--edge-soft)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[var(--ink-faint)]">
          read-only
        </span>
      </header>
      <div className="min-h-0 flex-1">
        {view.type === "code" && (
          <CodeEditor docId={token} initialContent={view.content} language={view.language} onChange={() => {}} readOnly />
        )}
        {view.type === "draw" && (
          <Suspense fallback={<Centered>loading canvas…</Centered>}>
            <DrawCanvas docId={token} initialContent={view.content} viewMode />
          </Suspense>
        )}
        {view.type === "mind" && (
          <Suspense fallback={<Centered>loading mindmap…</Centered>}>
            <MindCanvas docId={token} initialContent={view.content} viewMode />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <span className="mono text-sm text-[var(--ink-faint)]">{children}</span>
    </div>
  );
}
