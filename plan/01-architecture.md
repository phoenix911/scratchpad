# Slate — Architecture

```
┌──────────────────────── single Go binary ────────────────────────┐
│  net/http + chi router                                            │
│   ├─ /api/*        authed JSON API (snippets, drawings, folders)  │
│   ├─ /s/<token>    PUBLIC read-only share view (no auth)          │
│   ├─ /healthz                                                     │
│   └─ /* (embed.FS) the built React SPA                            │
│                                                                   │
│  SQLite (modernc.org/sqlite, pure-Go)  → index + shares + settings│
│  go-git (pure-Go)                      → commit/push/pull to GH   │
│  data/  working tree                   → the git repo on disk     │
└───────────────────────────────────────────────────────────────────┘
```

## Why these choices
- **Pure-Go SQLite + git** (no cgo, no system `git`/libsqlite): trivial
  cross-compile to the NAS arch (often ARM), ~20–30 MB idle RAM, one file to ship.
- **Excalidraw runs in the browser** — server RAM is unaffected. It is
  code-split, so editor-only sessions never download it.
- **Files-on-disk are the source of truth** — git diffs read well, recovery is
  trivial; SQLite is a rebuildable index, not the system of record.

## Backend packages
| Package | Responsibility |
|---|---|
| `cmd/slate/main.go` | wire-up, config load, embed.FS SPA, graceful shutdown |
| `internal/config` | load `.env` + real env vars (PORT, GIT_URL, GIT_PAT, SLATE_PASSWORD, …); hash password in memory |
| `internal/store` | SQLite open/migrate; item & share CRUD; disk⇄DB reconcile |
| `internal/items` | file write/read/delete, slug+id naming, language detect |
| `internal/git` | go-git wrapper: EnsureRepo, Pull, debounced CommitAndPush |
| `internal/share` | token mint, TTL clamp [1d,30d], expiry, public render payload |
| `internal/httpapi` | chi routes, password session middleware, public `/s/<token>` |

## Frontend
Vite + React + TypeScript SPA, embedded into the Go binary via `embed.FS`.
- CodeMirror 6 (custom theme) for code.
- `@excalidraw/excalidraw` (lazy/code-split) for drawings.
- Zustand (state), Framer Motion (animation), Tailwind (styling).

## Request flow (save)
```
edit → debounce → PUT /api/items/:id → write file to data/items/...
     → store.Update (SQLite index) → git debounce 5s → CommitAndPush → GitHub
```

## Request flow (share, public)
```
GET /s/<token> → share.Lookup(token) → expired? 410 : revoked? 404
              → load item file → render read-only (CodeMirror RO / Excalidraw viewMode)
```
The public share handler **bypasses** the password middleware. `/healthz` too.
