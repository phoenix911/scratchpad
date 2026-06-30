import { useMemo } from "react";
import { useStore } from "@/store";
import type { Item } from "@/lib/api";
import { FileBadge } from "@/components/ui/FileBadge";
import { ArchiveIcon, TrashIcon, RestoreIcon, FolderIcon } from "@/components/ui/icons";

type Kind = "archive" | "trash";

// Shared view for the two "put-away" collections: the archive and the recycle
// bin. Both list items grouped by folder with per-item actions; the recycle bin
// adds permanent delete + empty-all.
export function CollectionView({ kind }: { kind: Kind }) {
  const allItems = useStore((s) => s.items);
  const setActive = useStore((s) => s.setActive);
  const setItemState = useStore((s) => s.setItemState);
  const deleteItem = useStore((s) => s.deleteItem);

  const items = useMemo(
    () => allItems.filter((i) => (kind === "archive" ? i.archived && !i.trashed : i.trashed)),
    [allItems, kind],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const arr = map.get(it.folder) ?? [];
      arr.push(it);
      map.set(it.folder, arr);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
      .map(([folder, list]) => ({ folder, list: list.slice().sort((a, b) => b.updatedAt - a.updatedAt) }));
  }, [items]);

  const meta =
    kind === "archive"
      ? { title: "Archive", icon: <ArchiveIcon size={18} />, empty: "Nothing archived." }
      : { title: "Recycle bin", icon: <TrashIcon size={18} />, empty: "Recycle bin is empty." };

  async function emptyBin() {
    if (!confirm(`Permanently delete all ${items.length} item(s) in the recycle bin?`)) return;
    for (const it of items) await deleteItem(it.id);
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <header className="mb-6 flex items-center gap-2.5">
          <span className="text-[var(--ink-soft)]">{meta.icon}</span>
          <h1 className="text-[22px] font-semibold text-[var(--ink)]">{meta.title}</h1>
          <span className="text-[13px] text-[var(--ink-faint)]">
            {items.length} {items.length === 1 ? "item" : "items"}
          </span>
          {kind === "trash" && items.length > 0 && (
            <button
              onClick={emptyBin}
              className="ml-auto rounded-[var(--radius)] border border-[var(--danger)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--danger)] transition hover:bg-[var(--danger)] hover:text-white"
            >
              Empty recycle bin
            </button>
          )}
        </header>

        {items.length === 0 && (
          <p className="py-20 text-center text-[13px] text-[var(--ink-faint)]">{meta.empty}</p>
        )}

        <div className="space-y-7">
          {groups.map(({ folder, list }) => (
            <section key={folder || " root"}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                <FolderIcon size={13} />
                <span>{folder || "Top level"}</span>
                <span className="opacity-70">{list.length}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                {list.map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center gap-2.5 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--raised)] px-3 py-2.5"
                  >
                    <button
                      onClick={() => setActive(it.id)}
                      title="Open"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <FileBadge itemType={it.type} language={it.language} />
                      <span className="block truncate text-[13px] text-[var(--ink)]">{it.title}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <IconBtn title="Restore" onClick={() => setItemState(it.id, "active")}>
                        <RestoreIcon size={14} />
                      </IconBtn>
                      {kind === "archive" ? (
                        <IconBtn title="Move to recycle bin" onClick={() => setItemState(it.id, "trashed")}>
                          <TrashIcon size={14} />
                        </IconBtn>
                      ) : (
                        <IconBtn
                          title="Delete permanently"
                          danger
                          onClick={() => {
                            if (confirm(`Permanently delete “${it.title}”?`)) deleteItem(it.id);
                          }}
                        >
                          <TrashIcon size={14} />
                        </IconBtn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-[var(--radius)] p-1.5 text-[var(--ink-faint)] transition hover:bg-[var(--hover)] ${
        danger ? "hover:text-[var(--danger)]" : "hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
