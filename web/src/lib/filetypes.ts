// File-type metadata for the sidebar badges and language dropdown. Code items
// show their extension (.go, .py, .ts…); Excalidraw drawings show ".ed". Each
// gets a subtle accent color so file types are scannable at a glance.

export interface FileType {
  ext: string; // shown in the badge WITHOUT the leading dot
  color: string;
  label: string; // human label for menus
}

// language id (matches backend) -> file type
export const FILE_TYPES: Record<string, FileType> = {
  text: { ext: "txt", color: "#8a8f98", label: "Text" },
  markdown: { ext: "md", color: "#6a9fb5", label: "Markdown" },
  javascript: { ext: "js", color: "#d6a200", label: "JavaScript" },
  typescript: { ext: "ts", color: "#3178c6", label: "TypeScript" },
  tsx: { ext: "tsx", color: "#3178c6", label: "TSX" },
  json: { ext: "json", color: "#b58900", label: "JSON" },
  html: { ext: "html", color: "#e3743c", label: "HTML" },
  css: { ext: "css", color: "#7d6bd6", label: "CSS" },
  python: { ext: "py", color: "#4b8bbe", label: "Python" },
  go: { ext: "go", color: "#00add8", label: "Go" },
  rust: { ext: "rs", color: "#c98a5e", label: "Rust" },
  java: { ext: "java", color: "#b07219", label: "Java" },
  c: { ext: "c", color: "#8a8f98", label: "C" },
  cpp: { ext: "cpp", color: "#9178c6", label: "C++" },
  sql: { ext: "sql", color: "#d98c00", label: "SQL" },
  yaml: { ext: "yaml", color: "#cb6e6e", label: "YAML" },
  shell: { ext: "sh", color: "#5fa85f", label: "Shell" },
};

export const DRAW_TYPE: FileType = { ext: "ed", color: "#9b6dd6", label: "Drawing" };
export const MIND_TYPE: FileType = { ext: "mm", color: "#0ca678", label: "Mindmap" };
export const DOC_TYPE: FileType = { ext: "doc", color: "#5c7cfa", label: "Doc" };
export const KANBAN_TYPE: FileType = { ext: "kb", color: "#e64980", label: "Board" };
export const CORNELL_TYPE: FileType = { ext: "cn", color: "#f08c00", label: "Cornell note" };

// Languages offered in the dropdown, in display order.
export const LANGUAGES = [
  "text",
  "markdown",
  "javascript",
  "typescript",
  "tsx",
  "json",
  "html",
  "css",
  "python",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "sql",
  "yaml",
  "shell",
] as const;

export type ItemKind = "code" | "draw" | "mind" | "doc" | "kanban" | "cornell";

export function fileTypeFor(itemType: ItemKind, language: string): FileType {
  switch (itemType) {
    case "draw":
      return DRAW_TYPE;
    case "mind":
      return MIND_TYPE;
    case "doc":
      return DOC_TYPE;
    case "kanban":
      return KANBAN_TYPE;
    case "cornell":
      return CORNELL_TYPE;
    default:
      return FILE_TYPES[language] ?? { ext: language || "txt", color: "#8a8f98", label: language || "Text" };
  }
}
