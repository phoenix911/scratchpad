# Architecture

```
┌──────────────────────── single Go binary ────────────────────────┐
│  net/http + chi router                                            │
│   ├─ /api/*        authed JSON API (items, folders, share, sync…) │
│   ├─ /s/<token>    PUBLIC read-only share page (SSR'd OG tags)    │
│   ├─ /uploads/*    PUBLIC uploaded images                         │
│   ├─ /og/*.png     PUBLIC share-link preview images               │
│   ├─ /healthz                                                     │
│   └─ /* (embed.FS) the built React SPA                            │
│                                                                   │
│  SQLite (modernc.org/sqlite, pure-Go)  → index of items/shares…  │
│  system `git`                          → sync the data dir        │
│  DATA_DIR  (git working tree)          → the files on disk        │
└───────────────────────────────────────────────────────────────────┘
```

## Principles

- **Files are the source of truth.** Each item is a real file under
  `DATA_DIR/items`. The git-friendly layout makes diffs meaningful and recovery
  trivial.
- **SQLite is a rebuildable index**, not the system of record. Delete it and it's
  reconstructed from the files on next boot (`reconcile`).
- **One static binary.** The React app is built and embedded via `embed.FS`, so
  there's nothing else to deploy.
- **Pure-Go SQLite + system git** → trivial cross-compilation (incl. ARM),
  ~20–30 MB idle RAM.

## Go packages

| Package | Responsibility |
|---|---|
| `cmd/scratchpad` | wiring, config load, embedded SPA, graceful shutdown |
| `internal/config` | env / `.env` configuration |
| `internal/store` | SQLite: items, shares, links, settings; disk⇄DB reconcile |
| `internal/items` | file read/write, slug+id naming, folders, `[[link]]` parsing |
| `internal/git` | data-repo sync (clone/pull/commit/push) + per-file history |
| `internal/og` | in-process PNG preview images for share links |
| `internal/httpapi` | chi routes, password-session auth, all handlers |

## Frontend

Vite + React + TypeScript, embedded into the binary. Components are grouped under
`web/src/components/{layout,editors,overlays,ui}` and imported via the `@/`
alias. The heavy editors (Excalidraw, Mind Elixir, Tiptap, Kanban) are
code-split, so opening a code snippet never downloads them.

## Request flow (save)

```
edit → debounce → PUT /api/items/:id → write file → update SQLite index
     → parse [[links]] → schedule a debounced git commit + push
```
