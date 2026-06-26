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

1. **Cross-compile** for the NAS arch on your dev machine:
   ```bash
   make cross           # → scratchpad-linux-arm64 (override GOOS/GOARCH if needed)
   ```
2. **Copy** the binary + a `.env` to the NAS (e.g. `/opt/scratchpad/`). Make sure
   `git` is installed and the box's SSH key has push access to the data repo:
   ```bash
   ssh nas 'git -C /tmp ls-remote git@github.com:you/scratchpad-data.git'  # should list refs
   ```
3. **Run it** under systemd (`/etc/systemd/system/scratchpad.service`):
   ```ini
   [Unit]
   Description=Scratchpad
   After=network-online.target

   [Service]
   WorkingDirectory=/opt/scratchpad
   EnvironmentFile=/opt/scratchpad/.env
   ExecStart=/opt/scratchpad/scratchpad-linux-arm64
   Restart=always
   User=youruser

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable --now scratchpad
   ```
4. **Expose it** with a Cloudflare Tunnel so share links work from anywhere:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   # or a named tunnel mapping scratchpad-suh.z6o.cc → localhost:8080
   ```
   Set `SHARE_BASE_URL` to that public host so share links and OG previews use it.
   (Tailscale Funnel works too — point it at the same port.)

## Notes
- The app trusts `X-Forwarded-Proto: https` from the tunnel to set Secure cookies.
- `data/` is its own git repo (the content); this source repo is separate.
- Share links are SSR'd with Open Graph tags + an auto-generated funny SFW preview
  image, so they unfurl nicely in chat apps.

## Status
See `plan/TASKLIST.md`.
