# Item types

Scratchpad has six item types. They all share the same pipeline — a file on
disk, autosave, git sync, version history, and read-only sharing — and differ
only in their editor and on-disk format.

| Type | Badge | Editor | Stored as | Extension |
|---|---|---|---|---|
| Code | `.go` `.py` … | [CodeMirror 6](https://codemirror.net) | source text | the language's extension |
| Drawing | `.ed` | [Excalidraw](https://excalidraw.com) | scene JSON | `.excalidraw` |
| Mindmap | `.mm` | [Mind Elixir](https://mind-elixir.com) | tree JSON | `.mind` |
| Doc | `.doc` | [Tiptap](https://tiptap.dev) | HTML | `.doc` |
| Board | `.kb` | custom Kanban (dnd-kit) | board JSON | `.kanban` |
| Cornell note | `.cn` | built-in cue / notes / summary layout | JSON | `.cornell` |

Create any of them from the **⌘K** command palette.

## Organizing in folders

Every item has an optional **folder**. The sidebar groups items by folder
(collapsible sections); items with no folder sit at the top.

To move an item into a folder, open it and use the **folder field** in the
sidebar inspector — type a name (existing folders autocomplete) and the item
moves there. Typing a new name creates the folder; clearing it moves the item
back to the top level. On disk this is just a subdirectory under
`DATA_DIR/items/<folder>/`, so your folder structure is mirrored in the git repo.

## Notes

- **Code** detects/sets a language; the file gets that language's real extension
  so it renders and diffs nicely in your git host.
- **Drawing / Mindmap / Board** store editor JSON; they're rendered read-only
  (pan/zoom, no edit) in shares and version previews.
- **Doc** stores HTML (git-diffable), supports Markdown-style input rules, and
  lets you paste images (stored under `DATA_DIR/assets`).
- Any item can reference another with `[[Item Title]]`; see the backlinks panel.
