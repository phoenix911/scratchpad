import { useEffect, useState } from "react";
import { api, type Backlinks } from "../lib/api";
import { useStore } from "../store";
import { FileBadge } from "./FileBadge";

// Shows [[wiki-link]] relationships for the active item: who links here
// (backlinks) and what this item links out to. Click to navigate.
export function LinksPanel({ itemId, updatedAt }: { itemId: string; updatedAt: number }) {
  const [data, setData] = useState<Backlinks | null>(null);
  const setActive = useStore((s) => s.setActive);

  useEffect(() => {
    let alive = true;
    api
      .backlinks(itemId)
      .then((d) => alive && setData(d))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [itemId, updatedAt]);

  const back = data?.backlinks ?? [];
  const out = data?.outgoing ?? [];
  if (back.length === 0 && out.length === 0) return null;

  return (
    <div className="mb-2.5 space-y-2">
      {back.length > 0 && (
        <Section label="Linked from">
          {back.map((it) => (
            <Row key={it.id} onClick={() => setActive(it.id)}>
              <FileBadge itemType={it.type} language={it.language} />
              <span className="truncate">{it.title}</span>
            </Row>
          ))}
        </Section>
      )}
      {out.length > 0 && (
        <Section label="Links to">
          {out.map((o, i) =>
            o.item ? (
              <Row key={i} onClick={() => setActive(o.item!.id)}>
                <FileBadge itemType={o.item.type} language={o.item.language} />
                <span className="truncate">{o.item.title}</span>
              </Row>
            ) : (
              <div key={i} className="flex items-center gap-2 px-1.5 py-1 text-[12px] text-[var(--ink-faint)]">
                <span className="opacity-60">[[</span>
                <span className="truncate">{o.title}</span>
                <span className="opacity-60">]]</span>
              </div>
            ),
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-1.5 pb-0.5 text-[10px] uppercase tracking-wide text-[var(--ink-faint)]">{label}</p>
      {children}
    </div>
  );
}

function Row({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-[5px] px-1.5 py-1 text-left text-[12px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
    >
      {children}
    </button>
  );
}
