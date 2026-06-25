import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  app: string;
  syncEnabled: boolean;
  heapBytes: number;
};

// Placeholder shell for M0 — verifies the SPA is embedded and talks to the API.
// The real AppShell (sidebar, ⌘K, editor) arrives in M3.
export function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/healthz")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        {health?.app ?? "Slate"}
      </h1>
      <p className="text-[var(--color-muted)]">
        Personal code &amp; diagram workspace
      </p>
      <div className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-surface)] px-5 py-3 text-sm">
        {health ? (
          <span>
            server ok · sync{" "}
            <span className="text-[var(--color-accent)]">
              {health.syncEnabled ? "on" : "off"}
            </span>{" "}
            · heap {(health.heapBytes / 1024).toFixed(0)} KB
          </span>
        ) : (
          <span className="text-[var(--color-muted)]">connecting…</span>
        )}
      </div>
    </div>
  );
}
