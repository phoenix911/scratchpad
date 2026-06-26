# Configuration

All configuration comes from environment variables. On boot, Scratchpad also
reads a `.env` file (KEY=VALUE lines) from the working directory if present —
but **real environment variables always override** file values, so the file is
optional. Point at a different file with `SCRATCHPAD_ENV=/path/to/file`.

## Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Port the HTTP server listens on. |
| `BIND` | (all interfaces) | Bind address. Set `127.0.0.1` when running behind a reverse proxy or tunnel. |
| `SCRATCHPAD_PASSWORD` | (empty) | Single-password gate. Empty = no auth (the app is open). Set this if it's reachable beyond localhost. |
| `SHARE_BASE_URL` | (empty) | Public URL the app is reachable at (e.g. `https://pad.example.com`). Used to build absolute share links; if empty, links are relative. |
| `GIT_URL` | (empty) | Remote to sync the data dir to. SSH (`git@github.com:you/repo.git`) or HTTPS (`https://github.com/you/repo.git`). Empty = local only, no sync. |
| `GIT_USER` | (empty) | Username for HTTPS git auth. |
| `GIT_PAT` | (empty) | Personal access token for HTTPS git auth. Not needed for SSH. |
| `GIT_AUTHOR_NAME` | `scratchpad` | Author name for commits to the data repo. |
| `GIT_AUTHOR_EMAIL` | `scratchpad@local` | Author email for commits to the data repo. |
| `DATA_DIR` | `./data` | Directory holding item files; this is the git working tree when sync is on. |
| `DB_PATH` | `./scratchpad.db` | SQLite index path. Rebuildable from `DATA_DIR` — safe to delete. |
| `APP_NAME` | `Scratchpad` | Branding shown in the UI / tab title. |

## Auth model

- The single password protects the app (`/api/*` and the editor UI).
- **Share routes are intentionally public** (`/s/<token>`, `/uploads/<file>`,
  the share API and preview images) so view-only links work for anyone — the app
  relies on unguessable tokens, not auth, for shares.
- Sessions are stateless, HMAC-signed cookies; the signing secret is generated
  once and stored in the SQLite `settings` table.

## Notes

- Behind a TLS-terminating proxy/tunnel, the app trusts `X-Forwarded-Proto:
  https` to set Secure cookies.
- Secrets (`.env`, the SQLite DB) should live **outside** `DATA_DIR` so they're
  never committed to the data repo.
