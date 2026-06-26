import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

// Editor theme driven by the app's CSS variables, so it tracks light/dark with
// the rest of the UI. Transparent background, monospace, quiet gutters.
const base = EditorView.theme({
  "&": { color: "var(--ink)", backgroundColor: "transparent", height: "100%", fontSize: "13.5px" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7", padding: "12px 8px 40vh" },
  ".cm-content": { caretColor: "var(--accent)", padding: "0 0 0 8px" },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--accent-soft)",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--ink-faint)",
    border: "none",
    fontFamily: "var(--font-mono)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--ink-soft)" },
  ".cm-activeLine": { backgroundColor: "var(--hover)" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px" },
  ".cm-selectionMatch": { backgroundColor: "var(--accent-soft)" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid var(--accent)",
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--tok-comment)", fontStyle: "italic" },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "var(--tok-keyword)" },
  { tag: [t.string, t.special(t.string)], color: "var(--tok-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--tok-number)" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "var(--tok-func)" },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--tok-type)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--tok-prop)" },
  { tag: [t.operator, t.punctuation, t.bracket], color: "var(--tok-punct)" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "var(--ink)" },
  { tag: [t.tagName], color: "var(--tok-func)" },
  { tag: [t.heading], color: "var(--ink)", fontWeight: "700" },
  { tag: [t.link, t.url], color: "var(--accent)", textDecoration: "underline" },
  { tag: [t.invalid], color: "var(--danger)" },
]);

export function editorTheme(): Extension {
  return [base, syntaxHighlighting(highlight)];
}
