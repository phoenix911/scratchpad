# Slate — Execution Tasklist

Living checklist. Tick items as they land.

## M0 — Scaffold
- [ ] `go mod init`; add chi, modernc.org/sqlite, go-git, godotenv deps
- [ ] `internal/config`: load `.env` (PORT, GIT_URL, GIT_PAT, GIT_USER, SLATE_PASSWORD, DATA_DIR, DB_PATH, SHARE_BASE_URL)
- [ ] Vite React + TS app in `web/`; Zustand, Framer Motion, Tailwind, CodeMirror 6, @excalidraw/excalidraw
- [ ] Makefile: build web → `embed.FS` → single `slate` binary
- [ ] `/healthz` route + minimal `main.go` serving the embedded SPA on `PORT`
- [ ] `.env.example` committed; real `.env` gitignored

## M1 — Storage & items
- [ ] SQLite migrations (`items`, `shares`, `settings`) + `store` CRUD
- [ ] disk⇄DB reconcile on boot (walk `data/items`, upsert, prune)
- [ ] `items` package: file write/read/delete, slug+shortid naming, language detect
- [ ] folders: create / rename / delete

## M2 — API + auth
- [ ] chi routes for items + folders
- [ ] single-password session middleware (bcrypt, signed cookie); `/login`,`/logout`,`/me`
- [ ] verify JSON contracts with curl

## M3 — Frontend shell
- [ ] AppShell (glass sidebar + content), theme system (dark/light), folder tree
- [ ] ⌘K command palette (new snippet, new drawing, jump, share, sync, theme)
- [ ] CodeEditor: CodeMirror 6 custom theme, language switcher, debounced autosave

## M4 — Diagrams
- [ ] DrawCanvas: lazy `@excalidraw/excalidraw`, themed to shell
- [ ] autosave scene JSON as a `draw` item (same item API as code)

## M5 — Sharing (code + drawings)
- [ ] `share` mint/revoke; TTL clamp [1,30] days, default 1
- [ ] `POST /api/items/:id/share`, `DELETE /api/shares/:token`
- [ ] public `/s/:token`: 404 revoked / 410 expired / ok
- [ ] ShareView: CodeMirror read-only (code) + Excalidraw `viewModeEnabled` (draw)
- [ ] ShareDialog UI (TTL slider, copy link, revoke) on both item types

## M6 — Git sync
- [ ] `internal/git`: EnsureRepo (clone/init), Pull on boot
- [ ] debounced CommitAndPush (5s coalesced) on save/delete
- [ ] "Sync now" button + SyncStatus pill; conflict surfacing
- [ ] `.gitignore` excludes `app.db` + `config.json`

## M7 — Polish & ship
- [ ] motion pass, empty states, keyboard shortcuts, light/dark parity
- [ ] login screen (single password from `SLATE_PASSWORD`); "sync off" pill when git env unset
- [ ] cross-compile build targets in Makefile (e.g. linux/arm64 for the NAS) → single binary
- [ ] README: `.env` setup, run-directly-on-NAS, tunnel (Tailscale / Cloudflare); optional systemd unit example
- [ ] footprint check: idle RSS < 40 MB; Excalidraw bundle not loaded on code routes
