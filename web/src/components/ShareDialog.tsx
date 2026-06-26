import { useEffect, useState } from "react";
import { api, type ShareLink } from "../lib/api";

function expiryLabel(expiresAt: number): string {
  if (expiresAt === 0) return "never expires";
  const ms = expiresAt * 1000 - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""} left`;
  if (hours >= 1) return `${hours} hour${hours > 1 ? "s" : ""} left`;
  return "under an hour left";
}

// View-only links. Defaults to "never expires"; a toggle reveals a 1–30 day
// expiry. Existing links are listed with copy + revoke.
export function ShareDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [never, setNever] = useState(true);
  const [ttl, setTtl] = useState(7);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.listShares(itemId).then(setLinks).catch(() => setLinks([]));
  }, [itemId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function create() {
    setBusy(true);
    try {
      const link = await api.createShare(itemId, never ? 0 : ttl);
      setLinks((l) => [link, ...l]);
      await copy(link.url);
    } finally {
      setBusy(false);
    }
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch {
      /* clipboard may be blocked on http */
    }
  }
  async function revoke(token: string) {
    await api.revokeShare(token);
    setLinks((l) => l.filter((x) => x.token !== token));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.32)" }}
      onClick={onClose}
    >
      <div
        className="pop-in w-full max-w-md overflow-hidden rounded-[10px] border border-[var(--line)] bg-[var(--raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-[var(--ink)]">Share a view-only link</h2>
          <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">Read-only. No editing, no sign-in.</p>
        </div>

        <div className="px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={never}
              onChange={(e) => setNever(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Never expires
          </label>

          {!never && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                <span className="text-[var(--ink-soft)]">Expires in</span>
                <span className="text-[var(--ink)]">
                  {ttl} day{ttl > 1 ? "s" : ""}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={ttl}
                onChange={(e) => setTtl(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          )}

          <button onClick={create} disabled={busy} className="btn-brutal mt-4 w-full px-4 py-2.5 text-[13px]">
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>

        {links.length > 0 && (
          <div className="border-t border-[var(--line)] px-5 py-3">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">Active links</p>
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.token}
                  className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-[var(--ink)]">{link.url}</div>
                    <div className="text-[11px] text-[var(--ink-faint)]">{expiryLabel(link.expiresAt)}</div>
                  </div>
                  <button
                    onClick={() => copy(link.url)}
                    className="rounded-[4px] border border-[var(--line)] px-2 py-1 text-[11px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
                  >
                    {copied === link.url ? "copied" : "copy"}
                  </button>
                  <button
                    onClick={() => revoke(link.token)}
                    className="rounded-[4px] px-2 py-1 text-[11px] text-[var(--ink-faint)] transition hover:text-[var(--danger)]"
                  >
                    revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
