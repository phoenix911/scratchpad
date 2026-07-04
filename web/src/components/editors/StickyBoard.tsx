import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TrashIcon, CheckIcon } from "@/components/ui/icons";

// A sticky board: a resizable grid of labeled cells holding colored sticky
// notes. Notes can be written, dragged between cells, coloured, marked done
// (strikethrough + dimmed) and deleted. Stored as JSON in a .sticky file.

type Size = "1x1" | "1x2" | "1x3" | "2x2";
const CELLS_FOR: Record<Size, number> = { "1x1": 1, "1x2": 2, "1x3": 3, "2x2": 4 };
const SIZES: Size[] = ["1x1", "1x2", "1x3", "2x2"];
// Inline grid templates (not Tailwind classes) so the layout can never be lost
// to class purging when the size changes.
const GRID_STYLE: Record<Size, React.CSSProperties> = {
  "1x1": { gridTemplateColumns: "1fr", gridTemplateRows: "1fr" },
  "1x2": { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr" },
  "1x3": { gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr" },
  "2x2": { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr" },
};

// Preset note colours — tinted so they read in both light and dark themes.
const COLORS = [
  { key: "yellow", hex: "#f4c025" },
  { key: "green", hex: "#40c057" },
  { key: "blue", hex: "#4dabf7" },
  { key: "pink", hex: "#f06595" },
  { key: "purple", hex: "#ae3ec9" },
  { key: "gray", hex: "#adb5bd" },
] as const;
const DEFAULT_COLOR = COLORS[0].key;
const colorHex = (key: string) => COLORS.find((c) => c.key === key)?.hex ?? COLORS[0].hex;

interface Sticky {
  id: string;
  text: string;
  color: string;
  done: boolean;
}
interface Cell {
  id: string;
  title: string;
  stickies: Sticky[];
}
interface Board {
  size: Size;
  cells: Cell[];
}

interface Props {
  docId: string;
  initialContent: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function makeCell(title: string): Cell {
  return { id: uid("cell"), title, stickies: [] };
}

function defaultBoard(): Board {
  return { size: "1x1", cells: [makeCell("Notes")] };
}

function parseBoard(content: string): Board {
  if (content.trim()) {
    try {
      const b = JSON.parse(content) as Board;
      if (b && CELLS_FOR[b.size] && Array.isArray(b.cells)) return b;
    } catch {
      /* fall through */
    }
  }
  return defaultBoard();
}

// Grow by appending empty cells; shrink by moving orphaned stickies into the
// last kept cell so nothing is ever lost.
function resize(board: Board, size: Size): Board {
  const want = CELLS_FOR[size];
  let cells = board.cells.slice();
  if (cells.length < want) {
    while (cells.length < want) cells.push(makeCell(`Cell ${cells.length + 1}`));
  } else if (cells.length > want) {
    const kept = cells.slice(0, want);
    const orphaned = cells.slice(want).flatMap((c) => c.stickies);
    kept[want - 1] = { ...kept[want - 1], stickies: [...kept[want - 1].stickies, ...orphaned] };
    cells = kept;
  }
  return { size, cells };
}

export function StickyBoard({ docId, initialContent, onChange, readOnly }: Props) {
  const [board, setBoard] = useState<Board>(() => parseBoard(initialContent));
  const [active, setActive] = useState<Sticky | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setBoard(parseBoard(initialContent)), [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(next: Board) {
    setBoard(next);
    onChange?.(JSON.stringify(next));
  }

  const cellOf = (stickyId: string) => board.cells.find((c) => c.stickies.some((s) => s.id === stickyId));

  function onDragStart(e: DragStartEvent) {
    const s = board.cells.flatMap((c) => c.stickies).find((s) => s.id === e.active.id);
    setActive(s ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = cellOf(active.id as string);
    const to = board.cells.find((c) => c.id === over.id) ?? cellOf(over.id as string);
    if (!from || !to || from.id === to.id) return;
    const sticky = from.stickies.find((s) => s.id === active.id)!;
    setBoard((b) => ({
      ...b,
      cells: b.cells.map((c) => {
        if (c.id === from.id) return { ...c, stickies: c.stickies.filter((s) => s.id !== sticky.id) };
        if (c.id === to.id) return { ...c, stickies: [...c.stickies, sticky] };
        return c;
      }),
    }));
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const { active, over } = e;
    if (!over) return;
    const cell = cellOf(active.id as string);
    if (!cell) return;
    const oldIndex = cell.stickies.findIndex((s) => s.id === active.id);
    const overIndex = cell.stickies.findIndex((s) => s.id === over.id);
    const next: Board =
      overIndex >= 0 && oldIndex !== overIndex
        ? { ...board, cells: board.cells.map((c) => (c.id === cell.id ? { ...c, stickies: arrayMove(c.stickies, oldIndex, overIndex) } : c)) }
        : board;
    commit(next);
  }

  // --- mutations ---
  const addSticky = (cellId: string, text: string) =>
    commit({
      ...board,
      cells: board.cells.map((c) =>
        c.id === cellId ? { ...c, stickies: [...c.stickies, { id: uid("sticky"), text, color: DEFAULT_COLOR, done: false }] } : c,
      ),
    });
  const patchSticky = (id: string, patch: Partial<Sticky>) =>
    commit({
      ...board,
      cells: board.cells.map((c) => ({ ...c, stickies: c.stickies.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    });
  const delSticky = (id: string) =>
    commit({ ...board, cells: board.cells.map((c) => ({ ...c, stickies: c.stickies.filter((s) => s.id !== id) })) });
  const renameCell = (cellId: string, title: string) =>
    commit({ ...board, cells: board.cells.map((c) => (c.id === cellId ? { ...c, title } : c)) });

  const grid = (
    <div className="grid h-full gap-3 p-4" style={GRID_STYLE[board.size]}>
      {board.cells.map((cell) => (
        <CellView
          key={cell.id}
          cell={cell}
          readOnly={readOnly}
          onAddSticky={addSticky}
          onPatchSticky={patchSticky}
          onDelSticky={delSticky}
          onRename={renameCell}
        />
      ))}
    </div>
  );

  const bar = !readOnly && (
    <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-2">
      <span className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">Size</span>
      <div className="flex overflow-hidden rounded-[6px] border border-[var(--line)]">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => commit(resize(board, s))}
            className={`px-2 py-1 text-[12px] tabular-nums transition ${
              board.size === s ? "bg-[var(--active)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--hover)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  if (readOnly) return <div className="flex h-full flex-col bg-[var(--page)]">{grid}</div>;

  return (
    <div className="flex h-full flex-col bg-[var(--page)]">
      {bar}
      <div className="min-h-0 flex-1">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
          {grid}
          <DragOverlay>{active ? <StickyShell sticky={active} dragging /> : null}</DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

function CellView({
  cell,
  readOnly,
  onAddSticky,
  onPatchSticky,
  onDelSticky,
  onRename,
}: {
  cell: Cell;
  readOnly?: boolean;
  onAddSticky: (cellId: string, text: string) => void;
  onPatchSticky: (id: string, patch: Partial<Sticky>) => void;
  onDelSticky: (id: string) => void;
  onRename: (cellId: string, title: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: cell.id });
  const [adding, setAdding] = useState("");

  return (
    <div className="flex min-h-0 flex-col rounded-[10px] border border-[var(--line)] bg-[var(--sidebar)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          value={cell.title}
          disabled={readOnly}
          onChange={(e) => onRename(cell.id, e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)] outline-none"
        />
        <span className="text-[11px] text-[var(--ink-faint)]">{cell.stickies.length}</span>
      </div>

      <div ref={setNodeRef} className="grid min-h-[8px] flex-1 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] content-start gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={cell.stickies.map((s) => s.id)} strategy={rectSortingStrategy}>
          {cell.stickies.map((s) => (
            <SortableSticky key={s.id} sticky={s} readOnly={readOnly} onPatch={onPatchSticky} onDel={onDelSticky} />
          ))}
        </SortableContext>
      </div>

      {!readOnly && (
        <div className="px-2 pb-2">
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && adding.trim()) {
                onAddSticky(cell.id, adding.trim());
                setAdding("");
              }
            }}
            placeholder="+ Add sticky"
            className="w-full rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--line)] focus:bg-[var(--page)]"
          />
        </div>
      )}
    </div>
  );
}

function SortableSticky({
  sticky,
  readOnly,
  onPatch,
  onDel,
}: {
  sticky: Sticky;
  readOnly?: boolean;
  onPatch: (id: string, patch: Partial<Sticky>) => void;
  onDel: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sticky.id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StickyShell
        sticky={sticky}
        readOnly={readOnly}
        onToggleDone={() => onPatch(sticky.id, { done: !sticky.done })}
        onEdit={(text) => onPatch(sticky.id, { text })}
        onColor={(color) => onPatch(sticky.id, { color })}
        onDelete={() => onDel(sticky.id)}
      />
    </div>
  );
}

function StickyShell({
  sticky,
  readOnly,
  dragging,
  onToggleDone,
  onEdit,
  onColor,
  onDelete,
}: {
  sticky: Sticky;
  readOnly?: boolean;
  dragging?: boolean;
  onToggleDone?: () => void;
  onEdit?: (text: string) => void;
  onColor?: (color: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const hex = colorHex(sticky.color);
  const style = {
    background: `color-mix(in srgb, ${hex} 22%, var(--page))`,
    borderColor: `color-mix(in srgb, ${hex} 45%, transparent)`,
  };

  return (
    <div
      className={`group relative flex min-h-[72px] flex-col rounded-[8px] border px-2 py-1.5 text-[13px] text-[var(--ink)] ${
        dragging ? "shadow-lg" : readOnly ? "" : "cursor-grab"
      }`}
      style={style}
    >
      <div className="mb-1 flex items-center justify-between">
        <button
          disabled={readOnly}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone?.();
          }}
          title={sticky.done ? "Mark not done" : "Mark done"}
          className={`flex h-4 w-4 items-center justify-center rounded-[4px] border transition ${
            sticky.done ? "border-transparent bg-[var(--ink)] text-[var(--page)]" : "border-[var(--ink-faint)] text-transparent hover:border-[var(--ink-soft)]"
          }`}
        >
          <CheckIcon size={11} />
        </button>
        {!readOnly && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="hidden rounded p-0.5 text-[var(--ink-faint)] transition hover:text-[var(--danger)] group-hover:block"
          >
            <TrashIcon size={12} />
          </button>
        )}
      </div>

      {editing && !readOnly ? (
        <textarea
          autoFocus
          defaultValue={sticky.text}
          onPointerDown={(e) => e.stopPropagation()}
          onBlur={(e) => {
            onEdit?.(e.target.value.trim());
            setEditing(false);
          }}
          className="w-full flex-1 resize-none bg-transparent text-[13px] text-[var(--ink)] outline-none"
          rows={Math.max(2, sticky.text.split("\n").length)}
        />
      ) : (
        <span
          onClick={readOnly ? undefined : () => setEditing(true)}
          className={`flex-1 whitespace-pre-wrap break-words ${sticky.done ? "text-[var(--ink-faint)] line-through" : ""}`}
        >
          {sticky.text || <span className="text-[var(--ink-faint)]">empty</span>}
        </span>
      )}

      {!readOnly && onColor && (
        <div className="mt-1 hidden gap-1 group-hover:flex">
          {COLORS.map((c) => (
            <button
              key={c.key}
              onClick={(e) => {
                e.stopPropagation();
                onColor(c.key);
              }}
              title={c.key}
              className={`h-3 w-3 rounded-full border transition ${sticky.color === c.key ? "border-[var(--ink)]" : "border-transparent"}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
