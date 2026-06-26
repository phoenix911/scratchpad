import { useEffect, useMemo, useRef } from "react";
import { Excalidraw, serializeAsJSON } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { useStore } from "@/store";

interface Props {
  docId: string;
  initialContent: string;
  viewMode?: boolean;
  onChange?: (content: string) => void;
}

// Parse a stored .excalidraw scene; tolerate empty/blank documents.
function parseScene(content: string) {
  if (!content.trim()) return null;
  try {
    const data = JSON.parse(content);
    return {
      elements: (data.elements ?? []) as ExcalidrawElement[],
      appState: (data.appState ?? {}) as Partial<AppState>,
      files: (data.files ?? {}) as BinaryFiles,
    };
  } catch {
    return null;
  }
}

// Drop runtime-only appState fields that shouldn't be restored (collaborators
// is a Map that doesn't round-trip through JSON).
function stripTransient(appState: Partial<AppState>): Partial<AppState> {
  const { collaborators: _c, ...rest } = appState as Record<string, unknown>;
  return rest as Partial<AppState>;
}

// The drawing surface. This module (and all of Excalidraw) is code-split via a
// React.lazy import in Workspace, so opening a code snippet never loads it.
export function DrawCanvas({ docId, initialContent, viewMode, onChange }: Props) {
  const theme = useStore((s) => s.theme);
  const initial = useMemo(() => parseScene(initialContent), [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Excalidraw fires onChange on mount and on pure pan/zoom. Gate autosave to
  // real element edits via a cheap signature (id+version+deleted), so opening a
  // drawing or panning never triggers a write.
  const sigRef = useRef<string | null>(null);
  useEffect(() => {
    sigRef.current = null; // re-baseline when the open document changes
  }, [docId]);
  function signature(elements: readonly ExcalidrawElement[]): string {
    let s = "";
    for (const el of elements) s += el.id + ":" + el.version + (el.isDeleted ? "d" : "") + ";";
    return s;
  }

  return (
    <div className="h-full w-full">
      <Excalidraw
        key={docId}
        theme={theme}
        viewModeEnabled={viewMode}
        initialData={
          initial ? { elements: initial.elements, appState: stripTransient(initial.appState) } : null
        }
        onChange={(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
          if (!onChange) return;
          const sig = signature(elements);
          if (sigRef.current === null) {
            sigRef.current = sig; // record baseline on first (mount) callback
            return;
          }
          if (sig === sigRef.current) return; // pan/zoom/selection — nothing to save
          sigRef.current = sig;
          onChange(serializeAsJSON(elements, appState, files, "local"));
        }}
      />
    </div>
  );
}
