import { useEffect, useRef } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { editorTheme } from "../lib/cmTheme";

interface Props {
  docId: string; // changing this remounts the document
  initialContent: string;
  language: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
}

// Resolve a language id (our ids ~ CodeMirror's names/aliases) to a LanguageSupport.
async function loadLanguage(lang: string) {
  const desc =
    languages.find((l) => l.name.toLowerCase() === lang.toLowerCase()) ??
    languages.find((l) => l.alias.includes(lang.toLowerCase()));
  if (!desc) return null;
  try {
    return await desc.load();
  } catch {
    return null;
  }
}

export function CodeEditor({ docId, initialContent, language, onChange, readOnly }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langComp = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Build the editor once per document.
  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        indentUnit.of("  "),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        editorTheme(),
        langComp.current.of([]),
        EditorView.lineWrapping,
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: host.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Remount only when the document identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  // Load/replace the language extension when it changes.
  useEffect(() => {
    let alive = true;
    loadLanguage(language).then((support) => {
      if (!alive || !viewRef.current) return;
      viewRef.current.dispatch({
        effects: langComp.current.reconfigure(support ? support : []),
      });
    });
    return () => {
      alive = false;
    };
  }, [language, docId]);

  return <div ref={host} className="h-full w-full overflow-hidden" />;
}
