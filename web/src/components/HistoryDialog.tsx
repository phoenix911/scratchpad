import { useEffect, useState } from "react";
import { api, type Commit, type ItemType } from "../lib/api";
import { ItemViewer } from "./ItemViewer";
import { useStore } from "../store";

function when(unix: number): string {
  const d = new Date(unix * 1000);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

// Version history: a left list of commits touching this file, a right read-only
// preview of the selected version, and a restore action.
export function HistoryDialog({
  itemId,
  type,
  language,
  onClose,
}: {
  itemId: string;
  type: ItemType;
  language: string;
  onClose: () => void;
}) {
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useStore((s) => s.refresh);
  const bumpReload = useStore((s) => s.bumpReload);

  useEffect(() => {
    api
      .history(itemId)
      .then((r) => {
        setCommits(r.commits);
        setSyncEnabled(r.syncEnabled);
        if (r.commits[0]) void select(r.commits[0].hash);
      })
      .catch(() => setCommits([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function select(hash: string) {
    setSel(hash);
    setPreview(null);
    try {
      setPreview(await api.historyVersion(itemId, hash));
    } catch {
      setPreview("");
    }
  }

  async function restore(hash: string) {
    setBusy(true);
    try {
      await api.restore(itemId, hash);
      await refresh();
      bumpReload();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.32)" }}
      onClick={onClose}
    >
      <div
        className="pop-in flex h-[78vh] w-full max-w-4xl overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* commit list */}
        <div className="flex w-64 shrink-0 flex-col border-r border-[var(--line)]">
          <div className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-semibold">Version history</div>
          <div className="flex-1 overflow-y-auto p-2">
            {commits === null && <p className="px-2 py-4 text-[12px] text-[var(--ink-faint)]">Loading…</p>}
            {commits && commits.length === 0 && (
              <p className="px-2 py-4 text-[12px] text-[var(--ink-faint)]">
                {syncEnabled ? "No saved versions yet." : "History needs git sync enabled."}
              </p>
            )}
            {commits?.map((c, i) => (
              <button
                key={c.hash}
                onClick={() => select(c.hash)}
                className={`flex w-full flex-col gap-0.5 rounded-[6px] px-2.5 py-2 text-left transition ${
                  sel === c.hash ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"
                }`}
              >
                <span className="truncate text-[12px] text-[var(--ink)]">{c.message}</span>
                <span className="text-[11px] text-[var(--ink-faint)]">
                  {i === 0 ? "current · " : ""}
                  {when(c.date)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* preview */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
            <span className="text-[12px] text-[var(--ink-soft)]">{sel ? "Preview" : "Select a version"}</span>
            {sel && commits && commits[0]?.hash !== sel && (
              <button
                onClick={() => restore(sel)}
                disabled={busy}
                className="rounded-[6px] bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Restoring…" : "Restore this version"}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-[var(--page)]">
            {preview !== null && sel ? (
              <ItemViewer type={type} content={preview} language={language} docId={sel} />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--ink-faint)]">
                {sel ? "Loading…" : "Pick a version on the left"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
