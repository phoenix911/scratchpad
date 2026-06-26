import { useEffect, useState } from "react";
import { api, type SyncStatus } from "@/lib/api";
import { useStore } from "@/store";

function ago(unix: number): string {
  if (!unix) return "never";
  const s = Math.floor(Date.now() / 1000 - unix);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const COLOR: Record<SyncStatus["state"], string> = {
  off: "var(--ink-faint)",
  idle: "#3aa76d",
  syncing: "var(--accent)",
  conflict: "var(--danger)",
  error: "var(--danger)",
};

// Compact sync indicator + "sync now" in the sidebar footer. Hidden when off.
export function SyncPill() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useStore((s) => s.refresh);

  useEffect(() => {
    api.syncStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status || !status.enabled) return null;

  async function syncNow() {
    setBusy(true);
    try {
      const next = await api.sync();
      setStatus(next);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const label =
    status.state === "conflict"
      ? "conflict"
      : status.state === "error"
        ? "sync error"
        : busy || status.state === "syncing"
          ? "syncing…"
          : `synced ${ago(status.lastSync)}`;

  return (
    <button
      onClick={syncNow}
      disabled={busy}
      title={status.message || "Sync now"}
      className="flex items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1 text-[11px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)] disabled:opacity-60"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: COLOR[status.state] }} />
      {label}
    </button>
  );
}
