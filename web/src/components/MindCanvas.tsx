import { useEffect, useRef } from "react";
import MindElixir, { type MindElixirData, type MindElixirInstance, type Theme } from "mind-elixir";
import "mind-elixir/style";
import { useStore } from "../store";

interface Props {
  docId: string;
  initialContent: string;
  viewMode?: boolean;
  onChange?: (content: string) => void;
}

// A modern branch palette (clean, saturated mid-tones).
const PALETTE = [
  "#4263eb",
  "#0ca678",
  "#f76707",
  "#ae3ec9",
  "#1098ad",
  "#e8590c",
  "#7048e8",
  "#f03e3e",
];

// Custom themes that match the app: transparent canvas (the page shows through),
// monospace nodes, the app accent on the root, soft rounded cards.
function modernTheme(dark: boolean): Theme {
  const common = {
    "--node-gap-x": "28px",
    "--node-gap-y": "10px",
    "--main-gap-x": "44px",
    "--main-gap-y": "26px",
    "--root-radius": "12px",
    "--main-radius": "10px",
    "--topic-padding": "8px 14px",
    "--bgcolor": "transparent",
    "--map-padding": "80px",
  };
  if (dark) {
    return {
      name: "scratchpad-dark",
      type: "dark",
      palette: PALETTE,
      cssVar: {
        ...common,
        "--main-color": "#e9e9e7",
        "--main-bgcolor": "#252525",
        "--main-border": "1px solid rgba(255,255,255,0.09)",
        "--color": "#cfcfcd",
        "--selected": "#529cca",
        "--accent-color": "#529cca",
        "--root-color": "#ffffff",
        "--root-bgcolor": "#2f6da3",
        "--root-border-color": "transparent",
        "--panel-color": "#e9e9e7",
        "--panel-bgcolor": "#202020",
        "--panel-border-color": "rgba(255,255,255,0.09)",
      },
    };
  }
  return {
    name: "scratchpad-light",
    type: "light",
    palette: PALETTE,
    cssVar: {
      ...common,
      "--main-color": "#37352f",
      "--main-bgcolor": "#ffffff",
      "--main-border": "1px solid rgba(55,53,47,0.12)",
      "--color": "#4b4a45",
      "--selected": "#2383e2",
      "--accent-color": "#2383e2",
      "--root-color": "#ffffff",
      "--root-bgcolor": "#2383e2",
      "--root-border-color": "transparent",
      "--panel-color": "#37352f",
      "--panel-bgcolor": "#ffffff",
      "--panel-border-color": "rgba(55,53,47,0.12)",
    },
  };
}

function parseData(content: string): MindElixirData {
  if (content.trim()) {
    try {
      return JSON.parse(content) as MindElixirData;
    } catch {
      /* fall through */
    }
  }
  return MindElixir.new("New mindmap");
}

// Mind Elixir mindmap surface. Same integration shape as the Excalidraw canvas:
// code-split, themed to the app, autosaves its JSON on edit, read-only in share.
export function MindCanvas({ docId, initialContent, viewMode, onChange }: Props) {
  const theme = useStore((s) => s.theme);
  const host = useRef<HTMLDivElement>(null);
  const meRef = useRef<MindElixirInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const me = new MindElixir({
      el: host.current,
      direction: MindElixir.SIDE,
      editable: !viewMode,
      theme: modernTheme(theme === "dark"),
    });
    me.init(parseData(initialContent));
    if (!viewMode) {
      me.bus.addListener("operation", () => onChangeRef.current?.(me.getDataString()));
    }
    meRef.current = me;
    return () => {
      meRef.current = null;
      me.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  useEffect(() => {
    meRef.current?.changeTheme?.(modernTheme(theme === "dark"), true);
  }, [theme]);

  return <div ref={host} className="mindmap-host h-full w-full" style={{ fontFamily: "var(--font-mono)" }} />;
}
