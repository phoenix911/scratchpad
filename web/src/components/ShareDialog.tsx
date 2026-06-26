import { useEffect, useState } from "react";
import { api, type ShareLink } from "../lib/api";

interface Props {
  itemId: string;
  onClose: () => void;
}

function expiryLabel(expiresAt: number): string {
  const ms = expiresAt * 1000 - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days >= 1) return `${days} day${days > 1 ? "s" : ""} left`;
  if (hours >= 1) return `${hours} hour${hours > 1 ? "s" : ""} left`;
  return "under an hour left";
}

// View-only link sharing. A TTL slider (1–30 days) mints a link; existing links
// are listed with their expiry and can be revoked.
export function ShareDialog({ itemId, onClose }: Props) {
  const [ttl, setTtl] = useState(1);
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
      const link = await api.createShare(itemId, ttl);
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
      /* clipboard may be blocked on http; the link is still selectable */
    }
  }

  async function revoke(token: string) {
    await api.revokeShare(token);
    setLinks((l) => l.filter((x) => x.token !== token));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "color-mix(in srgb, var(--paper) 55%, transparent)" }}
      onClick={onClose}
    >
      <div
        className="pop-in w-full max-w-md overflow-hidden rounded-[16px] border border-[var(--edge)] shadow-2xl"
        style={{ background: "var(--panel)", backdropFilter: "blur(24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--edge-soft)] px-5 py-4">
          <h2 className="text-sm font-medium">Share a view-only link</h2>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Anyone with the link can read this — no editing, no sign-in.
          </p>
        </div>

        <div className="px-5 py-4">
          <div className="mb-2 flex items-baseline justify-between">
            <label className="mono text-xs uppercase tracking-widest text-[var(--ink-faint)]">
              Expires in
            </label>
            <span className="mono text-sm text-[var(--ink)]">
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
          <div className="mono mt-1 flex justify-between text-[10px] text-[var(--ink-faint)]">
            <span>1 day</span>
            <span>30 days max</span>
          </div>

          <button
            onClick={create}
            disabled={busy}
            className="mt-4 w-full rounded-[10px] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create link"}
          </button>
        </div>

        {links.length > 0 && (
          <div className="border-t border-[var(--edge-soft)] px-5 py-3">
            <p className="mono mb-2 text-[10px] uppercase tracking-widest text-[var(--ink-faint)]">
              Active links
            </p>
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.token}
                  className="flex items-center gap-2 rounded-[10px] border border-[var(--edge-soft)] bg-[var(--paper-raised)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mono truncate text-xs text-[var(--ink)]">{link.url}</div>
                    <div className="text-[10px] text-[var(--ink-faint)]">
                      {expiryLabel(link.expiresAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(link.url)}
                    className="mono rounded-md border border-[var(--edge)] px-2 py-1 text-[11px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
                  >
                    {copied === link.url ? "copied" : "copy"}
                  </button>
                  <button
                    onClick={() => revoke(link.token)}
                    className="mono rounded-md px-2 py-1 text-[11px] text-[var(--ink-faint)] transition hover:text-[var(--danger)]"
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
