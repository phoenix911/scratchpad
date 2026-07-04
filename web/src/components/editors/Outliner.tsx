import { useEffect, useRef, useState } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";

// A WorkFlowy-style collapsible outliner: an infinitely nestable bullet tree.
// Tab/Shift-Tab indent/outdent, Enter adds a sibling (or splits text), Backspace
// on an empty bullet removes it, arrows move between bullets, the triangle
// collapses a branch, clicking a bullet zooms into it, and Ctrl/Cmd+Enter marks
// a bullet done (strikethrough + dimmed). Stored as JSON in a .wf file.

interface Node {
  id: string;
  text: string;
  note?: string;
  collapsed?: boolean;
  done?: boolean;
  children: Node[];
}
interface Outline {
  nodes: Node[];
}

interface Props {
  docId: string;
  initialContent: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

// Each bullet dot gets its own colour, derived from the node id so it's random
// across bullets but stable for a given bullet across renders. Fixed saturation
// and lightness keep every hue readable in both light and dark themes.
function dotColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 65% 55%)`;
}

let counter = 0;
const uid = () => `n-${Date.now().toString(36)}-${(counter++).toString(36)}`;
const makeNode = (text = ""): Node => ({ id: uid(), text, children: [] });

function defaultOutline(): Outline {
  return { nodes: [makeNode("")] };
}

function parseOutline(content: string): Outline {
  if (content.trim()) {
    try {
      const o = JSON.parse(content) as Outline;
      if (o && Array.isArray(o.nodes)) return o.nodes.length ? o : defaultOutline();
    } catch {
      /* fall through */
    }
  }
  return defaultOutline();
}

// Locate a node: the array that holds it, its index there, and its parent (null
// at the top level). Searches the mutable draft in place.
type Loc = { arr: Node[]; index: number; parent: Node | null };
function locate(nodes: Node[], id: string, parent: Node | null = null): Loc | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return { arr: nodes, index: i, parent };
    const inChild = locate(nodes[i].children, id, nodes[i]);
    if (inChild) return inChild;
  }
  return null;
}

function findNode(nodes: Node[], id: string): Node | null {
  const l = locate(nodes, id);
  return l ? l.arr[l.index] : null;
}

// Ancestor chain (root→node, excluding node) for the zoom breadcrumb.
function ancestors(nodes: Node[], id: string): Node[] {
  const path: Node[] = [];
  const walk = (ns: Node[], trail: Node[]): boolean => {
    for (const n of ns) {
      if (n.id === id) {
        path.push(...trail);
        return true;
      }
      if (walk(n.children, [...trail, n])) return true;
    }
    return false;
  };
  walk(nodes, []);
  return path;
}

// Flattened top-to-bottom order of currently-visible bullets (respecting
// collapse), used for arrow navigation and delete-focus.
function visibleFlat(nodes: Node[]): Node[] {
  const out: Node[] = [];
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      out.push(n);
      if (!n.collapsed && n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

// --- lightweight per-bullet markdown ---
type Parsed =
  | { kind: "heading"; level: number; text: string }
  | { kind: "todo"; checked: boolean; text: string }
  | { kind: "text"; text: string };

function parseLine(raw: string): Parsed {
  const h = /^(#{1,6})\s+(.*)$/.exec(raw);
  if (h) return { kind: "heading", level: h[1].length, text: h[2] };
  const t = /^(?:[-*]\s+)?\[([ xX])\]\s*(.*)$/.exec(raw);
  if (t) return { kind: "todo", checked: t[1].toLowerCase() === "x", text: t[2] };
  return { kind: "text", text: raw };
}

// Flip a "[ ]" / "[x]" checkbox marker in place, preserving any leading "- ".
function toggleTodoText(raw: string): string {
  return raw.replace(/^(\s*(?:[-*]\s+)?)\[([ xX])\]/, (_, pre, mark) => `${pre}[${mark === " " ? "x" : " "}]`);
}

// Render inline **bold**, *italic*, `code` and ~~strike~~.
function inline(text: string): React.ReactNode {
  if (!text) return null;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] != null) out.push(<strong key={key++}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<em key={key++}>{m[3]}</em>);
    else if (m[4] != null)
      out.push(
        <code key={key++} className="rounded bg-[var(--hover)] px-1 text-[0.9em]">
          {m[4]}
        </code>,
      );
    else if (m[5] != null) out.push(<span key={key++} className="line-through opacity-70">{m[5]}</span>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Outliner({ docId, initialContent, onChange, readOnly }: Props) {
  const [outline, setOutline] = useState<Outline>(() => parseOutline(initialContent));
  const [zoom, setZoom] = useState<string | null>(null);
  // Which bullet is currently being edited (shows a raw <input>); all others
  // render their markdown. null = nothing being edited.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Focus request: which node's input to focus next, and where to put the caret.
  const [focus, setFocus] = useState<{ id: string; pos: "start" | "end" } | null>(null);

  useEffect(() => {
    setOutline(parseOutline(initialContent));
    setZoom(null);
    setEditingId(null);
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(next: Outline) {
    setOutline(next);
    onChange?.(JSON.stringify(next));
  }
  // Structural edit against a deep clone (outlines are small; clone-per-edit keeps
  // the immutable-update logic trivial and bug-free).
  function edit(fn: (draft: Outline) => void) {
    const draft: Outline = structuredClone(outline);
    fn(draft);
    commit(draft);
  }

  const roots = () => (zoom ? findNode(outline.nodes, zoom)?.children ?? outline.nodes : outline.nodes);
  const zoomRoot = zoom ? findNode(outline.nodes, zoom) : null;

  // --- handlers ---
  const setText = (id: string, text: string) =>
    edit((d) => {
      const n = findNode(d.nodes, id);
      if (n) n.text = text;
    });

  const toggleCollapse = (id: string) =>
    edit((d) => {
      const n = findNode(d.nodes, id);
      if (n) n.collapsed = !n.collapsed;
    });

  const toggleTodo = (id: string) =>
    edit((d) => {
      const n = findNode(d.nodes, id);
      if (n) n.text = toggleTodoText(n.text);
    });

  // Click a rendered bullet → edit its raw text.
  const startEdit = (id: string) => {
    setEditingId(id);
    setFocus({ id, pos: "end" });
  };
  // When an input loses focus, drop out of edit mode only if focus left the
  // bullets entirely (so arrow/Tab moves between bullets stay in edit mode).
  const inputBlur = () =>
    setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.hasAttribute("data-bullet")) setEditingId(null);
    }, 0);

  // Enter: split at the caret. If the bullet is expanded and has children, the
  // remainder becomes its first child; otherwise a following sibling.
  function addAt(id: string, caret: number, value: string) {
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const newId = uid();
    edit((d) => {
      const loc = locate(d.nodes, id);
      if (!loc) return;
      const node = loc.arr[loc.index];
      node.text = before;
      const fresh: Node = { id: newId, text: after, children: [] };
      if (!node.collapsed && node.children.length) node.children.unshift(fresh);
      else loc.arr.splice(loc.index + 1, 0, fresh);
    });
    setEditingId(newId);
    setFocus({ id: newId, pos: "start" });
  }

  function indent(id: string) {
    edit((d) => {
      const loc = locate(d.nodes, id);
      if (!loc || loc.index === 0) return; // no previous sibling
      const prev = loc.arr[loc.index - 1];
      const [node] = loc.arr.splice(loc.index, 1);
      prev.collapsed = false;
      prev.children.push(node);
    });
    setFocus({ id, pos: "end" });
  }

  function outdent(id: string) {
    edit((d) => {
      const loc = locate(d.nodes, id);
      if (!loc || !loc.parent) return; // already top level
      if (zoom && loc.parent.id === zoom) return; // don't escape the zoom root
      const parentLoc = locate(d.nodes, loc.parent.id);
      if (!parentLoc) return;
      const [node] = loc.arr.splice(loc.index, 1);
      parentLoc.arr.splice(parentLoc.index + 1, 0, node);
    });
    setFocus({ id, pos: "end" });
  }

  // Backspace on an empty bullet: delete it and focus the previous visible one.
  function removeEmpty(id: string) {
    const flat = visibleFlat(roots());
    if (flat.length <= 1) return; // keep at least one bullet
    const idx = flat.findIndex((n) => n.id === id);
    const prev = idx > 0 ? flat[idx - 1] : null;
    edit((d) => {
      const loc = locate(d.nodes, id);
      if (loc && loc.arr[loc.index].children.length === 0) loc.arr.splice(loc.index, 1);
    });
    if (prev) {
      setEditingId(prev.id);
      setFocus({ id: prev.id, pos: "end" });
    }
  }

  function moveFocus(id: string, dir: -1 | 1) {
    const flat = visibleFlat(roots());
    const idx = flat.findIndex((n) => n.id === id);
    const next = flat[idx + dir];
    if (next) {
      setEditingId(next.id);
      setFocus({ id: next.id, pos: "end" });
    }
  }

  const list = roots();
  const empty = list.length === 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
      {/* Breadcrumb — only when zoomed in */}
      {zoom && (
        <div className="flex items-center gap-1.5 px-6 pt-5 text-[12px] text-[var(--ink-faint)]">
          <button onClick={() => setZoom(null)} className="transition hover:text-[var(--ink)]">
            Home
          </button>
          {ancestors(outline.nodes, zoom).map((a) => (
            <span key={a.id} className="flex items-center gap-1.5">
              <ChevronRightIcon size={11} />
              <button onClick={() => setZoom(a.id)} className="max-w-[160px] truncate transition hover:text-[var(--ink)]">
                {a.text || "untitled"}
              </button>
            </span>
          ))}
          <ChevronRightIcon size={11} />
          <span className="text-[var(--ink-soft)]">{zoomRoot?.text || "untitled"}</span>
        </div>
      )}

      {/* Zoomed bullet title */}
      {zoomRoot && (
        <div className="px-6 pt-2">
          <input
            key={zoomRoot.id}
            defaultValue={zoomRoot.text}
            disabled={readOnly}
            onBlur={(e) => setText(zoomRoot.id, e.target.value)}
            className="w-full bg-transparent text-[20px] font-semibold text-[var(--ink)] outline-none"
            placeholder="untitled"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-16 pt-5">
        {empty && <p className="px-2 py-6 text-[13px] text-[var(--ink-faint)]">Empty. Nothing to show here.</p>}
        {list.map((n) => (
          <Row
            key={n.id}
            node={n}
            depth={0}
            readOnly={readOnly}
            editingId={editingId}
            focus={focus}
            onText={setText}
            onEnter={addAt}
            onIndent={indent}
            onOutdent={outdent}
            onDelete={removeEmpty}
            onMove={moveFocus}
            onToggleCollapse={toggleCollapse}
            onToggleTodo={toggleTodo}
            onStartEdit={startEdit}
            onInputBlur={inputBlur}
            onZoom={setZoom}
          />
        ))}
      </div>
    </div>
  );
}

interface RowApi {
  readOnly?: boolean;
  editingId: string | null;
  focus: { id: string; pos: "start" | "end" } | null;
  onText: (id: string, text: string) => void;
  onEnter: (id: string, caret: number, value: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleCollapse: (id: string) => void;
  onToggleTodo: (id: string) => void;
  onStartEdit: (id: string) => void;
  onInputBlur: () => void;
  onZoom: (id: string) => void;
}

function Row({ node, depth, ...api }: { node: Node; depth: number } & RowApi) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasKids = node.children.length > 0;
  const collapsed = !!node.collapsed;
  const editing = api.editingId === node.id && !api.readOnly;

  // Apply a focus request targeting this row (the input only exists while editing).
  useEffect(() => {
    if (api.focus?.id !== node.id || !editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const at = api.focus.pos === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  }, [api.focus, node.id, editing]);

  // Auto-grow the textarea to fit all its lines (explicit breaks *and* wrapped
  // long lines), so nothing is clipped to the top line while editing.
  useEffect(() => {
    const el = inputRef.current;
    if (!editing || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, node.text]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (api.readOnly) return;
    const el = e.currentTarget;
    const caret = el.selectionStart ?? el.value.length;
    if ((e.metaKey || e.ctrlKey) && e.key === ".") {
      // Collapse/expand the current bullet's branch.
      e.preventDefault();
      if (hasKids) api.onToggleCollapse(node.id);
    } else if (e.key === "Enter" && !e.shiftKey) {
      // Plain Enter splits into a new bullet; Shift+Enter falls through to the
      // textarea's default and inserts a line break within this bullet.
      e.preventDefault();
      api.onEnter(node.id, caret, el.value);
    } else if (e.key === "Escape") {
      el.blur();
    } else if (e.key === "Tab") {
      e.preventDefault();
      api.onText(node.id, el.value); // persist current text before the move
      if (e.shiftKey) api.onOutdent(node.id);
      else api.onIndent(node.id);
    } else if (e.key === "Backspace" && el.value === "" && caret === 0) {
      e.preventDefault();
      api.onDelete(node.id);
    } else if (e.key === "ArrowUp") {
      // Only leave for the previous bullet from the first line.
      if (el.value.lastIndexOf("\n", caret - 1) === -1) {
        e.preventDefault();
        api.onMove(node.id, -1);
      }
    } else if (e.key === "ArrowDown") {
      // Only leave for the next bullet from the last line.
      if (el.value.indexOf("\n", caret) === -1) {
        e.preventDefault();
        api.onMove(node.id, 1);
      }
    }
  }

  return (
    <div>
      <div className="group flex items-start gap-1" style={{ paddingLeft: depth * 22 }}>
        {/* collapse triangle (only if it has children) */}
        <button
          onClick={() => hasKids && api.onToggleCollapse(node.id)}
          className={`flex h-5 w-4 shrink-0 items-center justify-center text-[15px] font-bold leading-none text-[var(--ink-soft)] ${hasKids ? "hover:text-[var(--ink)]" : "opacity-0"}`}
          tabIndex={-1}
        >
          {collapsed ? "+" : "−"}
        </button>
        {/* bullet dot — click to zoom in */}
        <button
          onClick={() => api.onZoom(node.id)}
          title="Zoom in"
          tabIndex={-1}
          className="mr-1 flex h-5 w-4 shrink-0 items-center justify-center"
        >
          <span
            className={`h-[7px] w-[7px] rounded-full transition ${
              collapsed && hasKids ? "ring-4 ring-[var(--hover)]" : ""
            }`}
            style={{ background: dotColor(node.id) }}
          />
        </button>
        {editing ? (
          <textarea
            ref={inputRef}
            data-bullet
            rows={1}
            value={node.text}
            onChange={(e) => api.onText(node.id, e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={api.onInputBlur}
            className="block w-full flex-1 resize-none overflow-hidden bg-transparent py-1 text-[14px] leading-[1.5] text-[var(--ink)] outline-none"
            placeholder=""
          />
        ) : (
          <Display node={node} readOnly={api.readOnly} onEdit={() => api.onStartEdit(node.id)} onToggleTodo={() => api.onToggleTodo(node.id)} />
        )}
      </div>

      {!collapsed && node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} {...api} />)}
    </div>
  );
}

// Rendered (non-editing) bullet: markdown headings, todo checkboxes and inline
// styles. Clicking the text switches the row into raw-edit mode.
function Display({
  node,
  readOnly,
  onEdit,
  onToggleTodo,
}: {
  node: Node;
  readOnly?: boolean;
  onEdit: () => void;
  onToggleTodo: () => void;
}) {
  const p = parseLine(node.text);
  const editable = readOnly ? undefined : onEdit;

  if (p.kind === "heading") {
    const cls = p.level === 1 ? "text-[18px] font-bold" : p.level === 2 ? "text-[16px] font-semibold" : "text-[14px] font-semibold";
    return (
      <div onClick={editable} className={`flex-1 cursor-text py-1 text-[var(--ink)] ${cls}`}>
        {inline(p.text) || <span className="text-[var(--ink-faint)]">&nbsp;</span>}
      </div>
    );
  }

  if (p.kind === "todo") {
    return (
      <div className="flex flex-1 items-center gap-2 py-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!readOnly) onToggleTodo();
          }}
          tabIndex={-1}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] transition ${
            p.checked ? "border-transparent bg-[var(--ink-faint)] text-[var(--page)]" : "border-[var(--line-strong)] text-transparent hover:border-[var(--ink-faint)]"
          }`}
        >
          ✓
        </button>
        <span onClick={editable} className={`flex-1 cursor-text text-[14px] ${p.checked ? "text-[var(--ink-faint)] line-through" : "text-[var(--ink)]"}`}>
          {inline(p.text) || <span className="text-[var(--ink-faint)]">&nbsp;</span>}
        </span>
      </div>
    );
  }

  return (
    <div onClick={editable} className="flex-1 cursor-text whitespace-pre-wrap break-words py-1 text-[14px] leading-[1.5] text-[var(--ink)]">
      {inline(node.text) || <span className="text-[var(--ink-faint)]">&nbsp;</span>}
    </div>
  );
}
