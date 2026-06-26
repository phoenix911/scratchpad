import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

// A custom editor theme driven by the app's CSS variables, so the editor tracks
// light/dark with the rest of the shell. Transparent background → the grid paper
// shows through. Cobalt accents match the signature.
const base = EditorView.theme({
  "&": {
    color: "var(--ink)",
    backgroundColor: "transparent",
    height: "100%",
    fontSize: "13.5px",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.7",
    padding: "8px 0 40vh",
  },
  ".cm-content": { caretColor: "var(--accent)", padding: "0 0 0 18px" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--accent-soft)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--ink-faint)",
    // Notebook margin rule: a faint cobalt line separating gutter from text.
    borderRight: "1px solid var(--edge-soft)",
    fontFamily: "var(--font-mono)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink-soft)" },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--ink) 4%, transparent)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px" },
  ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid var(--accent-line)",
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--ink-faint)", fontStyle: "italic" },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "#c78dff" },
  { tag: [t.string, t.special(t.string)], color: "#6fd3a0" },
  { tag: [t.number, t.bool, t.null], color: "#f0a878" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7aa2ff" },
  { tag: [t.typeName, t.className, t.namespace], color: "#54c7d4" },
  { tag: [t.propertyName, t.attributeName], color: "#9ab4ff" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--ink-soft)" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "var(--ink)" },
  { tag: [t.tagName], color: "#7aa2ff" },
  { tag: [t.heading], color: "var(--ink)", fontWeight: "700" },
  { tag: [t.link, t.url], color: "var(--accent)", textDecoration: "underline" },
  { tag: [t.invalid], color: "var(--danger)" },
]);

export function editorTheme(): Extension {
  return [base, syntaxHighlighting(highlight)];
}
