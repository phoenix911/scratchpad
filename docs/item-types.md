# Item types

Scratchpad has seven item types. They all share the same pipeline — a file on
disk, autosave, git sync, version history, and read-only sharing — and differ
only in their editor and on-disk format.

| Type | Badge | Editor | Stored as | Extension |
|---|---|---|---|---|
| Code | `.go` `.py` … | [CodeMirror 6](https://codemirror.net) | source text | the language's extension |
| Drawing | `.ed` | [Excalidraw](https://excalidraw.com) | scene JSON | `.excalidraw` |
| Mindmap | `.mm` | [Mind Elixir](https://mind-elixir.com) | tree JSON | `.mind` |
| Doc | `.doc` | [Tiptap](https://tiptap.dev) | HTML | `.doc` |
| Board | `.kb` | custom Kanban (dnd-kit) | board JSON | `.kanban` |
| Cornell note | `.cn` | cue / notes / summary layout (Markdown auto-formats) | JSON | `.cornell` |
| Sticky board | `.sb` | resizable grid of cells with colored sticky notes (dnd-kit) | board JSON | `.sticky` |

Create any of them from the **⌘K** command palette.

## Organizing in folders

Every item has an optional **folder**, and folders can be **nested**
(`work/projects/alpha`). The sidebar shows them as a collapsible tree; items
with no folder sit at the top.

Two ways to move items:

- **Drag and drop** — drag a file onto a folder to move it in, drag it between
  folders, or drop it on empty tree space to move it back to the top level.
- **Folder field** — open an item and type a folder name in the sidebar
  inspector (existing folders autocomplete); a new name creates the folder.

On disk this is just a subdirectory under `DATA_DIR/items/<folder>/`, so your
folder structure is mirrored in the git repo.

## Notes

- **Code** detects/sets a language; the file gets that language's real extension
  so it renders and diffs nicely in your git host.
- **Drawing / Mindmap / Board** store editor JSON; they're rendered read-only
  (pan/zoom, no edit) in shares and version previews.
- **Sticky board** is a resizable grid of labeled cells (1×1 default, or 1×2 /
  1×3 / 2×2) holding colored sticky notes you can drag between cells, mark done
  (strikethrough), and delete.
- **Doc** stores HTML (git-diffable), supports Markdown-style input rules, and
  lets you paste images (stored under `DATA_DIR/assets`).
- Any item can reference another with `[[Item Title]]`; see the backlinks panel.
