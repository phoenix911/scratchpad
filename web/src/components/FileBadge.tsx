import { fileTypeFor, type ItemKind } from "../lib/filetypes";

// A small monospace extension badge used as the file-type "icon": .go .py .ts .ed …
// Tinted by language so types are scannable at a glance.
export function FileBadge({
  itemType,
  language,
  size = "sm",
}: {
  itemType: ItemKind;
  language: string;
  size?: "sm" | "md";
}) {
  const ft = fileTypeFor(itemType, language);
  const pad = size === "md" ? "px-1.5 py-0.5 text-[11px]" : "px-1 py-[1px] text-[10px]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[4px] font-medium tabular-nums ${pad}`}
      style={{ color: ft.color, background: `color-mix(in srgb, ${ft.color} 14%, transparent)` }}
    >
      .{ft.ext}
    </span>
  );
}
