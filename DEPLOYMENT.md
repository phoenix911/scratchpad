# Deploying scratchpad

How scratchpad is deployed to the home server (`ubuntu-hyd-2`, the Dell box) and
exposed at **https://scratchpad-suh.z6o.cc**. The box is managed script-first via
`~/workspace/personal/local_setup` (idempotent shell scripts over SSH). Repeat
these steps to redeploy after code changes.

## Topology
- **Binary**: single static Go binary (embeds the React SPA), built on the Mac
  for `linux/amd64`, runs as systemd service `scratchpad`, bound to
  `127.0.0.1:6005`.
- **Public URL**: Cloudflare tunnel route `scratchpad-suh.z6o.cc` → `localhost:6005`,
  **public (no Cloudflare Access)** — the app has its own password gate, and the
  share routes (`/s/<token>`, `/og`, `/api/share`) must be reachable by anyone.
- **Data**: `/opt/scratchpad/data` is a git checkout of
  `git@github.com:phoenix911/scratchpad-data.git`, pushed via the box's own SSH
  deploy key. DB (`/opt/scratchpad/scratchpad.db`) and `.env` live outside it.
- **Box-side files**: `/opt/scratchpad/{scratchpad,.env,data,.ssh,Makefile}`,
  owned by the `scratchpad` system user.

## One-time setup (already done)
1. **GitHub repos**: `phoenix911/scratchpad` (source) and
   `phoenix911/scratchpad-data` (content, private).
2. **Deploy key**: the box generates `/opt/scratchpad/.ssh/id_ed25519` on first
   run; its public key is added to `scratchpad-data` with **write** access:
   ```bash
   ssh ubuntu-hyd 'sudo cat /opt/scratchpad/.ssh/id_ed25519.pub' > /tmp/k.pub
   gh repo deploy-key add /tmp/k.pub -R phoenix911/scratchpad-data \
     -t scratchpad-ubuntu-hyd --allow-write
   ```
3. **Cloudflare route** (public, no Access):
   ```bash
   cd ~/workspace/personal/local_setup
   ./scripts/lib/cf-api.sh expose-http-public scratchpad 6005
   ssh ubuntu-hyd 'sudo systemctl restart cloudflared'   # avoid new-route 404 lag
   ```

## Redeploy (after a code change)
From the scratchpad repo root on the Mac:
```bash
# 1. build SPA + cross-compile the linux binary
make web
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" \
  -o dist/scratchpad-linux-amd64 ./cmd/scratchpad

# 2. stage binary + env to the box (dist/ is gitignored — box.env holds secrets)
ssh ubuntu-hyd 'mkdir -p /tmp/scratchpad-stage'
scp dist/scratchpad-linux-amd64 ubuntu-hyd:/tmp/scratchpad-stage/
scp dist/box.env ubuntu-hyd:/tmp/scratchpad-stage/.env   # only if env changed

# 3. run the idempotent deploy script (installs binary+env, restarts service)
cd ~/workspace/personal/local_setup
SERVER_SSH_HOST=ubuntu-hyd ./scripts/deploy.sh services/scratchpad.sh
```
The box-side script is `scripts/services/scratchpad.sh` in `local_setup`.

## Box `.env`
Built on the Mac as `dist/box.env`, installed to `/opt/scratchpad/.env` (0600).
Never committed. Keys:
```dotenv
PORT=6005
BIND=127.0.0.1
SHARE_BASE_URL=https://scratchpad-suh.z6o.cc
SCRATCHPAD_PASSWORD=...                 # the single-password gate
GIT_URL=git@github.com:phoenix911/scratchpad-data.git
GIT_USER=phoenix911
GIT_AUTHOR_NAME=phoenix911              # identity for data-repo commits
GIT_AUTHOR_EMAIL=sangeet.verma91@gmail.com
DATA_DIR=/opt/scratchpad/data
DB_PATH=/opt/scratchpad/scratchpad.db
APP_NAME=scratchpad
```

## Control (on the box)
```bash
cd /opt/scratchpad && make status|logs|restart|health|deploykey
# or: sudo systemctl {status,restart,stop} scratchpad ; journalctl -u scratchpad -f
```

## Verify
```bash
curl -s https://scratchpad-suh.z6o.cc/healthz        # {"ok":true,"syncEnabled":true,...}
curl -so/dev/null -w '%{http_code}\n' https://scratchpad-suh.z6o.cc/api/items   # 401 (gated)
# data sync: create something in the UI, then
git clone git@github.com:phoenix911/scratchpad-data.git /tmp/d && git -C /tmp/d log
```

## Notes & gotchas
- **First boot before the deploy key is added** logs an "ensure repo failed"
  warning and runs local-only; it self-heals on the next restart once the key has
  write access.
- **New Cloudflare route 404s briefly** — restart `cloudflared` on the box.
- **Only port 22 is exposed** on the box; everything else is via the tunnel. The
  service binds loopback (`BIND=127.0.0.1`).
- **Rollback**: keep the previous `dist/scratchpad-linux-amd64`; re-stage it and
  re-run the deploy script. Config/unit writes are backed up under
  `/var/backups/server-setup/<ts>/` on the box.
