# Scratchpad

A personal, self-hosted workspace to write/save code snippets, draw Excalidraw
diagrams, organize them in folders, sync to a private git repo, and share
expiring view-only links. Single Go binary (embeds the React SPA), light on RAM,
designed to look gorgeous.

## Stack
- **Backend:** Go — `net/http` + chi, pure-Go SQLite (`modernc.org/sqlite`),
  go-git for sync. Embeds the SPA via `embed.FS`.
- **Frontend:** Vite + React + TypeScript, Tailwind, CodeMirror 6 (code),
  Excalidraw (diagrams).

## Configure
Copy `.env.example` to `.env` and fill it in (or set real env vars, which win):

```dotenv
PORT=8080
SHARE_BASE_URL=https://scratchpad.example.com   # tunnel host, for share links
SLATE_PASSWORD=...                               # single-password gate
GIT_URL=git@github.com:you/scratchpad-data.git   # SSH = no PAT needed
GIT_USER=you
DATA_DIR=./data
DB_PATH=./scratchpad.db
APP_NAME=Scratchpad
```

Git sync uses **SSH** when `GIT_URL` is an `git@`/`ssh://` URL — the deploy
machine's SSH key (agent or `~/.ssh/id_*`) authenticates; no token stored. Leave
`GIT_URL` blank to run local-only.

## Build & run
```bash
make all     # build SPA -> embed -> single binary
./scratchpad # serves on $PORT

make dev     # frontend dev server with API proxy (fast iteration)
make cross   # cross-compile linux/arm64 for a NAS
```

## Deploy (NAS, direct — no Docker)
Run the binary behind a Cloudflare Tunnel (or Tailscale). A sample systemd unit
is in the README's deploy section (M7).

## Status
Under active construction — see `plan/TASKLIST.md`.
