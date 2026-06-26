# Deployment

Scratchpad is a single static binary. Deploy = put the binary on a server, give
it a `.env`, run it under a process manager, and expose it through a reverse
proxy or tunnel so share links work from anywhere.

## 1. Build / get the binary

Cross-compile for your server's architecture on your dev machine:

```bash
make cross    # -> scratchpad-linux-amd64  (override GOOS/GOARCH as needed)
```

Or download a prebuilt binary from
[Releases](https://github.com/phoenix911/scratchpad/releases).

## 2. Put it on the server

```bash
ssh server 'mkdir -p /opt/scratchpad'
scp scratchpad-linux-amd64 server:/opt/scratchpad/scratchpad
```

Create `/opt/scratchpad/.env` (see [configuration.md](configuration.md)):

```dotenv
PORT=8080
BIND=127.0.0.1
SHARE_BASE_URL=https://pad.example.com
SCRATCHPAD_PASSWORD=change-me
GIT_URL=git@github.com:you/scratchpad-data.git   # optional; see git-sync.md
GIT_AUTHOR_NAME=you
GIT_AUTHOR_EMAIL=you@example.com
DATA_DIR=/opt/scratchpad/data
DB_PATH=/opt/scratchpad/scratchpad.db
```

`git` must be installed on the server if you enable sync.

## 3. Run it under systemd

`/etc/systemd/system/scratchpad.service`:

```ini
[Unit]
Description=Scratchpad
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/scratchpad
ExecStart=/opt/scratchpad/scratchpad
Restart=always
RestartSec=5
User=youruser

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now scratchpad
curl -s localhost:8080/healthz      # {"ok":true,...}
```

The app reads `./.env` from its `WorkingDirectory`, so no `EnvironmentFile` is
needed (though you can use one — real env vars override the file).

## 4. Expose it publicly

The service binds to loopback; put a public endpoint in front of it. Any of
these work — pick one:

**Caddy** (automatic HTTPS):
```
pad.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

**nginx:**
```nginx
server {
    server_name pad.example.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Cloudflare Tunnel** (no open ports / public IP needed):
```bash
cloudflared tunnel --url http://localhost:8080
# or a named tunnel mapping pad.example.com -> localhost:8080
```

**Tailscale Funnel:**
```bash
tailscale funnel 8080
```

Set `SHARE_BASE_URL` to whatever public host you chose so share links and
preview images resolve correctly.

## Updating

Replace the binary and restart:

```bash
scp scratchpad-linux-amd64 server:/opt/scratchpad/scratchpad
ssh server 'sudo systemctl restart scratchpad'
```

If you publish GitHub Releases, the server can instead pull the latest asset
itself (e.g. with `gh release download` on a timer) — see your own ops setup.

## Backups

Your data is a git repo (when sync is on) — that's your backup. The SQLite DB is
just an index and is rebuilt from `DATA_DIR` on boot, so it doesn't need backing
up.
