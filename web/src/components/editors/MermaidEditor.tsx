import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { toMermaid } from "@/lib/swimlanes";

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

  const diagram = (
    <div className="flex h-full items-center justify-center overflow-auto p-4">
      {svg ? (
        <div className="[&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <span className="text-[13px] text-[var(--ink-faint)]">{error ? "diagram error" : "empty"}</span>
      )}
    </div>
  );

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
