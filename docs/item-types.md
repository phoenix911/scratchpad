# Item types

Scratchpad has five item types. They all share the same pipeline — a file on
disk, autosave, git sync, version history, and read-only sharing — and differ
only in their editor and on-disk format.

| Type | Badge | Editor | Stored as | Extension |
|---|---|---|---|---|
| Code | `.go` `.py` … | [CodeMirror 6](https://codemirror.net) | source text | the language's extension |
| Drawing | `.ed` | [Excalidraw](https://excalidraw.com) | scene JSON | `.excalidraw` |
| Mindmap | `.mm` | [Mind Elixir](https://mind-elixir.com) | tree JSON | `.mind` |
| Doc | `.doc` | [Tiptap](https://tiptap.dev) | HTML | `.doc` |
| Board | `.kb` | custom Kanban (dnd-kit) | board JSON | `.kanban` |

Create any of them from the **⌘K** command palette.

## Notes

- **Code** detects/sets a language; the file gets that language's real extension
  so it renders and diffs nicely in your git host.
- **Drawing / Mindmap / Board** store editor JSON; they're rendered read-only
  (pan/zoom, no edit) in shares and version previews.
- **Doc** stores HTML (git-diffable), supports Markdown-style input rules, and
  lets you paste images (stored under `DATA_DIR/assets`).
- Any item can reference another with `[[Item Title]]`; see the backlinks panel.
