import { useMemo, useState } from "react";
import { useStore } from "@/store";
import type { Item } from "@/lib/api";
import { FileBadge } from "@/components/ui/FileBadge";
import { FolderIcon, SearchIcon } from "@/components/ui/icons";

// The home page (the app's "/"): a folder-grouped overview of every file, with a
// quick filter. Click any card to open it. Built to stay usable on small screens
// — the card grid reflows down to a single column.
export function HomeView() {
  const allItems = useStore((s) => s.items);
  const setActive = useStore((s) => s.setActive);
  const appName = useStore((s) => s.appName);
  const setPalette = useStore((s) => s.setPalette);
  const [q, setQ] = useState("");

  // Home shows only active items — archived / recycle-bin items live in their
  // own views.
  const items = useMemo(() => allItems.filter((i) => !i.archived && !i.trashed), [allItems]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? items.filter(
          (i) => i.title.toLowerCase().includes(needle) || i.folder.toLowerCase().includes(needle),
        )
      : items;
    const map = new Map<string, Item[]>();
    for (const it of filtered) {
      const arr = map.get(it.folder) ?? [];
      arr.push(it);
      map.set(it.folder, arr);
    }
    // Top-level (no folder) first, then folders alphabetically.
    return [...map.entries()]
      .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
      .map(([folder, list]) => ({
        folder,
        list: list.slice().sort((a, b) => b.updatedAt - a.updatedAt),
      }));
  }, [items, q]);

  const total = items.length;

  return (
    <div className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <header className="mb-6">
          <h1 className="text-[22px] font-semibold text-[var(--ink)]">{appName}</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-faint)]">
            {total} {total === 1 ? "file" : "files"} · press ⌘K to create
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--raised)] px-3 py-2">
            <SearchIcon size={15} className="text-[var(--ink-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter files…"
              className="w-full bg-transparent text-[14px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)]"
            />
          </div>
        </header>

        {total === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-[13px] text-[var(--ink-faint)]">No files yet.</p>
            <button onClick={() => setPalette(true)} className="btn-brutal px-4 py-2 text-[13px]">
              Press ⌘K to create
            </button>
          </div>
        )}

        {total > 0 && groups.length === 0 && (
          <p className="py-16 text-center text-[13px] text-[var(--ink-faint)]">No files match “{q}”.</p>
        )}

        <div className="space-y-7">
          {groups.map(({ folder, list }) => (
            <section key={folder || " root"}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                <FolderIcon size={13} />
                <span>{folder || "Top level"}</span>
                <span className="opacity-70">{list.length}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
                {list.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => setActive(it.id)}
                    className="group flex items-center gap-2.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5 text-left transition hover:border-[var(--accent)] hover:bg-[var(--hover)]"
                  >
                    <FileBadge itemType={it.type} language={it.language} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-[var(--ink)]">{it.title}</span>
                      <span className="block truncate text-[11px] text-[var(--ink-faint)]">
                        {relTime(it.updatedAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

// Compact relative time ("3d", "2h", "just now") for the card subtitle.
function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
