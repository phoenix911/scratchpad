import { useEffect, useState } from "react";
import { api, type SyncStatus } from "../lib/api";
import { useStore } from "../store";

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
  idle: "var(--ink-soft)",
  syncing: "var(--accent)",
  conflict: "var(--danger)",
  error: "var(--danger)",
};

// Compact sync indicator + "sync now" button. Hidden entirely when sync is off.
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
      await refresh(); // pulled changes may have added items
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
      className="mono flex items-center gap-1.5 rounded-md border border-[var(--edge-soft)] px-2 py-1 text-[11px] transition hover:border-[var(--edge)] disabled:opacity-60"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: COLOR[status.state], animation: busy ? "caret-blink 1s steps(1) infinite" : undefined }}
      />
      <span style={{ color: "var(--ink-soft)" }}>{label}</span>
    </button>
  );
}
