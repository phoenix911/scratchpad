import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { toMermaid } from "@/lib/swimlanes";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Pan (drag) + zoom (wheel / buttons) + fullscreen wrapper for the rendered SVG.
// Pure CSS transform, no deps.
function Zoomable({ svg, empty }: { svg: string; empty: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  const [t, setT] = useState({ x: 0, y: 0 });
  const [full, setFull] = useState(false);
  const st = useRef({ s: 1, t: { x: 0, y: 0 } });
  st.current = { s, t };
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const reset = () => {
    setS(1);
    setT({ x: 0, y: 0 });
  };

  // Zoom toward a point (px,py in container coords) by factor f.
  const zoomAt = (px: number, py: number, f: number) => {
    const { s: cs, t: ct } = st.current;
    const ns = clamp(cs * f, 0.1, 40);
    setT({ x: px - ((px - ct.x) / cs) * ns, y: py - ((py - ct.y) / cs) * ns });
    setS(ns);
  };

  // Native wheel listener (non-passive) so preventDefault works without warnings.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [full]); // re-bind when the fullscreen container swaps

  // Esc exits fullscreen.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  const btnZoom = (f: number) => {
    const r = box.current!.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, f);
  };

  return (
    <div
      ref={box}
      className={full ? "fixed inset-0 z-50 overflow-hidden bg-[var(--page)]" : "relative h-full w-full overflow-hidden"}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
      }}
      onPointerMove={(e) => {
        if (drag.current) setT({ x: drag.current.tx + (e.clientX - drag.current.x), y: drag.current.ty + (e.clientY - drag.current.y) });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
      style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
    >
      {svg ? (
        <div
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${s})`, transformOrigin: "0 0" }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-[13px] text-[var(--ink-faint)]">{empty}</span>
        </div>
      )}
      {svg && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--raised)] p-0.5 text-[13px] shadow-sm">
          <button onClick={() => btnZoom(1 / 1.2)} className="h-6 w-6 rounded text-[var(--ink-soft)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]">−</button>
          <button onClick={reset} title="Reset zoom" className="px-2 text-[11px] tabular-nums text-[var(--ink-soft)] transition hover:text-[var(--ink)]">{Math.round(s * 100)}%</button>
          <button onClick={() => btnZoom(1.2)} className="h-6 w-6 rounded text-[var(--ink-soft)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]">+</button>
          <button
            onClick={() => setFull((f) => !f)}
            title={full ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="ml-0.5 h-6 w-6 rounded border-l border-[var(--line)] text-[var(--ink-soft)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            {full ? "✕" : "⤢"}
          </button>
        </div>
      )}
    </div>
  );
}

// Text → diagram (Mermaid). Write mermaid syntax directly, or swimlanes.io-style
// sequence syntax which is transpiled (see lib/swimlanes.ts). Left pane edits,
// right pane live-renders. Read-only (shares/history) shows the diagram only.
interface Props {
  docId: string;
  initialContent: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
}

const STARTER = `// swimlanes syntax — or write mermaid directly
title: Login
User -> API: POST /login
API --> User: 200 ok
if: bad creds
  API --> User: 401
end`;

// Lazily loaded, initialized per theme.
let mermaidMod: typeof import("mermaid").default | null = null;
async function getMermaid(theme: "dark" | "light") {
  if (!mermaidMod) mermaidMod = (await import("mermaid")).default;
  mermaidMod.initialize({
    startOnLoad: false,
    theme: theme === "dark" ? "dark" : "default",
    securityLevel: "loose",
    maxTextSize: 5_000_000, // default 50k — allow big diagrams
    maxEdges: 5000, // default 500 — allow big flowcharts
  });
  return mermaidMod;
}

export function MermaidEditor({ docId, initialContent, onChange, readOnly }: Props) {
  const theme = useStore((s) => s.theme);
  const [code, setCode] = useState(() => initialContent || (readOnly ? "" : STARTER));
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nonce = useRef(0);

  // Reset when switching documents.
  useEffect(() => {
    setCode(initialContent || (readOnly ? "" : STARTER));
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // If a fresh diagram seeded the starter, persist it once.
  useEffect(() => {
    if (!readOnly && !initialContent && code === STARTER) onChange?.(STARTER);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced render on code / theme change. Keeps the last good SVG on error.
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const src = toMermaid(code).trim();
      if (!src) {
        setSvg("");
        setError(null);
        return;
      }
      try {
        const mermaid = await getMermaid(theme);
        await mermaid.parse(src);
        const { svg } = await mermaid.render(`mmd-${docId}-${nonce.current++}`, src);
        if (alive) {
          setSvg(svg);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(String((e as Error)?.message ?? e).split("\n")[0]);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [code, theme, docId]);

  const diagram = <Zoomable svg={svg} empty={error ? "diagram error" : "empty"} />;

  if (readOnly) return <div className="h-full bg-[var(--page)]">{diagram}</div>;

  return (
    <div className="flex h-full bg-[var(--page)]">
      <div className="flex w-1/2 flex-col border-r border-[var(--line)]">
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            onChange?.(e.target.value);
          }}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-[1.6] text-[var(--ink)] outline-none"
          placeholder="sequenceDiagram…  or  A -> B: hello"
        />
        {error && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-4 py-2 font-mono text-[12px] text-[var(--danger)]">
            {error}
          </div>
        )}
      </div>
      <div className="w-1/2">{diagram}</div>
    </div>
  );
}
