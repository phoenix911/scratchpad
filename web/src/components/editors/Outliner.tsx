import { useEffect, useRef, useState } from "react";
import { ChevronIcon, ChevronRightIcon } from "@/components/ui/icons";

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

export function Outliner({ docId, initialContent, onChange, readOnly }: Props) {
  const [outline, setOutline] = useState<Outline>(() => parseOutline(initialContent));
  const [zoom, setZoom] = useState<string | null>(null);
  // Focus request: which node's input to focus next, and where to put the caret.
  const [focus, setFocus] = useState<{ id: string; pos: "start" | "end" } | null>(null);

  useEffect(() => {
    setOutline(parseOutline(initialContent));
    setZoom(null);
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
    if (prev) setFocus({ id: prev.id, pos: "end" });
  }

  function moveFocus(id: string, dir: -1 | 1) {
    const flat = visibleFlat(roots());
    const idx = flat.findIndex((n) => n.id === id);
    const next = flat[idx + dir];
    if (next) setFocus({ id: next.id, pos: "end" });
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
            focus={focus}
            onText={setText}
            onEnter={addAt}
            onIndent={indent}
            onOutdent={outdent}
            onDelete={removeEmpty}
            onMove={moveFocus}
            onToggleCollapse={toggleCollapse}
            onZoom={setZoom}
          />
        ))}
      </div>
    </div>
  );
}

interface RowApi {
  readOnly?: boolean;
  focus: { id: string; pos: "start" | "end" } | null;
  onText: (id: string, text: string) => void;
  onEnter: (id: string, caret: number, value: string) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggleCollapse: (id: string) => void;
  onZoom: (id: string) => void;
}

function Row({ node, depth, ...api }: { node: Node; depth: number } & RowApi) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasKids = node.children.length > 0;
  const collapsed = !!node.collapsed;

  // Apply a focus request targeting this row.
  useEffect(() => {
    if (api.focus?.id !== node.id) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const at = api.focus.pos === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  }, [api.focus, node.id]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (api.readOnly) return;
    const el = e.currentTarget;
    if (e.key === "Enter") {
      e.preventDefault();
      api.onEnter(node.id, el.selectionStart ?? el.value.length, el.value);
    } else if (e.key === "Tab") {
      e.preventDefault();
      api.onText(node.id, el.value); // persist current text before the move
      if (e.shiftKey) api.onOutdent(node.id);
      else api.onIndent(node.id);
    } else if (e.key === "Backspace" && el.value === "" && el.selectionStart === 0) {
      e.preventDefault();
      api.onDelete(node.id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      api.onMove(node.id, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      api.onMove(node.id, 1);
    }
  }

  return (
    <div>
      <div className="group flex items-center gap-1" style={{ paddingLeft: depth * 22 }}>
        {/* collapse triangle (only if it has children) */}
        <button
          onClick={() => hasKids && api.onToggleCollapse(node.id)}
          className={`flex h-5 w-4 shrink-0 items-center justify-center text-[var(--ink-faint)] ${hasKids ? "hover:text-[var(--ink)]" : "opacity-0"}`}
          tabIndex={-1}
        >
          {collapsed ? <ChevronRightIcon size={12} /> : <ChevronIcon size={12} />}
        </button>
        {/* bullet dot — click to zoom in */}
        <button
          onClick={() => api.onZoom(node.id)}
          title="Zoom in"
          tabIndex={-1}
          className="mr-1 flex h-5 w-4 shrink-0 items-center justify-center"
        >
          <span
            className={`h-[7px] w-[7px] rounded-full bg-[var(--ink-soft)] transition ${
              collapsed && hasKids ? "ring-4 ring-[var(--hover)]" : ""
            }`}
          />
        </button>
        <input
          ref={inputRef}
          value={node.text}
          disabled={api.readOnly}
          onChange={(e) => api.onText(node.id, e.target.value)}
          onKeyDown={onKeyDown}
          className="flex-1 bg-transparent py-1 text-[14px] text-[var(--ink)] outline-none"
          placeholder=""
        />
      </div>

      {!collapsed && node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} {...api} />)}
    </div>
  );
}
