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
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";

interface Card {
  id: string;
  text: string;
}
interface Column {
  id: string;
  title: string;
  cards: Card[];
}
interface Board {
  columns: Column[];
}

interface Props {
  docId: string;
  initialContent: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function defaultBoard(): Board {
  return {
    columns: [
      { id: uid("col"), title: "To do", cards: [] },
      { id: uid("col"), title: "In progress", cards: [] },
      { id: uid("col"), title: "Done", cards: [] },
    ],
  };
}

function parseBoard(content: string): Board {
  if (content.trim()) {
    try {
      const b = JSON.parse(content) as Board;
      if (Array.isArray(b.columns)) return b;
    } catch {
      /* fall through */
    }
  }
  return defaultBoard();
}

export function KanbanBoard({ docId, initialContent, onChange, readOnly }: Props) {
  const [board, setBoard] = useState<Board>(() => parseBoard(initialContent));
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setBoard(parseBoard(initialContent)), [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutate + persist.
  function commit(next: Board) {
    setBoard(next);
    onChange?.(JSON.stringify(next));
  }

  const colOf = (cardId: string) => board.columns.find((c) => c.cards.some((k) => k.id === cardId));

  function onDragStart(e: DragStartEvent) {
    const c = board.columns.flatMap((col) => col.cards).find((k) => k.id === e.active.id);
    setActiveCard(c ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = colOf(active.id as string);
    const to = board.columns.find((c) => c.id === over.id) ?? colOf(over.id as string);
    if (!from || !to || from.id === to.id) return;
    // Move the card into the target column (append; final order set on drop).
    const card = from.cards.find((k) => k.id === active.id)!;
    setBoard((b) => ({
      columns: b.columns.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((k) => k.id !== card.id) };
        if (c.id === to.id) return { ...c, cards: [...c.cards, card] };
        return c;
      }),
    }));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    const { active, over } = e;
    if (!over) return;
    const col = colOf(active.id as string);
    if (!col) return;
    const oldIndex = col.cards.findIndex((k) => k.id === active.id);
    const overIndex = col.cards.findIndex((k) => k.id === over.id);
    const next: Board =
      overIndex >= 0 && oldIndex !== overIndex
        ? { columns: board.columns.map((c) => (c.id === col.id ? { ...c, cards: arrayMove(c.cards, oldIndex, overIndex) } : c)) }
        : board;
    commit(next);
  }

  // --- mutations ---
  const addCard = (colId: string, text: string) =>
    commit({ columns: board.columns.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, { id: uid("card"), text }] } : c)) });
  const editCard = (cardId: string, text: string) =>
    commit({ columns: board.columns.map((c) => ({ ...c, cards: c.cards.map((k) => (k.id === cardId ? { ...k, text } : k)) })) });
  const delCard = (cardId: string) =>
    commit({ columns: board.columns.map((c) => ({ ...c, cards: c.cards.filter((k) => k.id !== cardId) })) });
  const renameCol = (colId: string, title: string) =>
    commit({ columns: board.columns.map((c) => (c.id === colId ? { ...c, title } : c)) });
  const delCol = (colId: string) => commit({ columns: board.columns.filter((c) => c.id !== colId) });
  const addCol = () => commit({ columns: [...board.columns, { id: uid("col"), title: "New column", cards: [] }] });

  const inner = (
    <div className="flex h-full items-start gap-3 overflow-x-auto p-4">
      {board.columns.map((col) => (
        <ColumnView
          key={col.id}
          col={col}
          readOnly={readOnly}
          onAddCard={addCard}
          onEditCard={editCard}
          onDelCard={delCard}
          onRename={renameCol}
          onDelCol={delCol}
        />
      ))}
      {!readOnly && (
        <button
          onClick={addCol}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] border border-dashed border-[var(--line-strong)] px-3 text-[13px] text-[var(--ink-soft)] transition hover:bg-[var(--hover)]"
        >
          <PlusIcon size={14} /> Column
        </button>
      )}
    </div>
  );

  if (readOnly) return <div className="h-full bg-[var(--page)]">{inner}</div>;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd}>
      <div className="h-full bg-[var(--page)]">{inner}</div>
      <DragOverlay>{activeCard ? <CardShell text={activeCard.text} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function ColumnView({
  col,
  readOnly,
  onAddCard,
  onEditCard,
  onDelCard,
  onRename,
  onDelCol,
}: {
  col: Column;
  readOnly?: boolean;
  onAddCard: (colId: string, text: string) => void;
  onEditCard: (cardId: string, text: string) => void;
  onDelCard: (cardId: string) => void;
  onRename: (colId: string, title: string) => void;
  onDelCol: (colId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });
  const [adding, setAdding] = useState("");

  return (
    <div className="flex max-h-full w-[272px] shrink-0 flex-col rounded-[10px] border border-[var(--line)] bg-[var(--sidebar)]">
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          defaultValue={col.title}
          disabled={readOnly}
          onBlur={(e) => e.target.value.trim() && onRename(col.id, e.target.value.trim())}
          className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-soft)] outline-none"
        />
        <span className="text-[11px] text-[var(--ink-faint)]">{col.cards.length}</span>
        {!readOnly && (
          <button onClick={() => onDelCol(col.id)} className="text-[var(--ink-faint)] transition hover:text-[var(--danger)]">
            <TrashIcon size={13} />
          </button>
        )}
      </div>

      <div ref={setNodeRef} className="flex min-h-[8px] flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext items={col.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {col.cards.map((card) => (
            <SortableCard key={card.id} card={card} readOnly={readOnly} onEdit={onEditCard} onDel={onDelCard} />
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
                onAddCard(col.id, adding.trim());
                setAdding("");
              }
            }}
            placeholder="+ Add card"
            className="w-full rounded-[6px] border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-[var(--ink)] outline-none transition placeholder:text-[var(--ink-faint)] focus:border-[var(--line)] focus:bg-[var(--page)]"
          />
        </div>
      )}
    </div>
  );
}

function SortableCard({
  card,
  readOnly,
  onEdit,
  onDel,
}: {
  card: Card;
  readOnly?: boolean;
  onEdit: (id: string, text: string) => void;
  onDel: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: readOnly });
  const [editing, setEditing] = useState(false);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  if (editing && !readOnly) {
    return (
      <textarea
        ref={setNodeRef as unknown as React.Ref<HTMLTextAreaElement>}
        style={style}
        autoFocus
        defaultValue={card.text}
        onBlur={(e) => {
          onEdit(card.id, e.target.value.trim());
          setEditing(false);
        }}
        className="w-full resize-none rounded-[7px] border border-[var(--accent)] bg-[var(--page)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none"
        rows={Math.max(2, card.text.split("\n").length)}
      />
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardShell text={card.text} onClick={readOnly ? undefined : () => setEditing(true)} onDelete={readOnly ? undefined : () => onDel(card.id)} />
    </div>
  );
}

function CardShell({
  text,
  onClick,
  onDelete,
  dragging,
}: {
  text: string;
  onClick?: () => void;
  onDelete?: () => void;
  dragging?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative rounded-[7px] border border-[var(--line)] bg-[var(--page)] px-2.5 py-2 text-[13px] text-[var(--ink)] ${
        dragging ? "shadow-lg" : "cursor-grab"
      }`}
    >
      <span className="whitespace-pre-wrap break-words">{text}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1 hidden rounded p-0.5 text-[var(--ink-faint)] transition hover:text-[var(--danger)] group-hover:block"
        >
          <TrashIcon size={12} />
        </button>
      )}
    </div>
  );
}
