# Scratchpad on Cloudflare (Pages + Functions + R2 + D1)

A fully serverless deployment of Scratchpad that runs entirely on the Cloudflare
stack — no box to host. The **same React SPA** (`../web/dist`) is served by
Cloudflare Pages; the Go backend is reimplemented as **Pages Functions** (this
`functions/` dir) backed by:

- **D1** (serverless SQLite) — the index: `items`, `shares`, `links`, `settings`.
- **R2** (object storage) — blobs: `content/<id>` (item content) and `uploads/<name>` (pasted images).

## Differences from the Go deployment
The edge has no filesystem or `git`, so:
- **Git sync** is disabled (`/api/sync*` report `enabled:false`; the UI sync pill hides).
- **Version history / restore** is unavailable (`/api/items/:id/history` returns `[]`).
- **D1 is authoritative** for metadata; **R2 holds content** keyed by id.
- The **OG share image** is an SVG card (the Go app rasterizes a PNG). Links work; some social scrapers prefer PNG.

Everything else — all 8 item types, folders, archive, recycle bin, sharing,
image upload, backlinks — is at parity.

## One-time setup
```bash
cd cloudflare
npm install
# auth: export CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (see repo keys file)

wrangler d1 create scratchpad          # copy database_id → wrangler.jsonc
wrangler r2 bucket create scratchpad
wrangler d1 execute scratchpad --remote --file schema.sql

wrangler pages project create scratchpad --production-branch main
wrangler pages secret put SCRATCHPAD_PASSWORD --project-name scratchpad   # optional gate
```

## Deploy
```bash
(cd ../web && npm ci && npm run build)   # build the SPA
wrangler pages deploy ../web/dist --project-name scratchpad
```
Or from the repo root: `make deploy-cf`.

## Custom domain
Attach `scratchpad.z6o.cc` in the Pages project (Dashboard → Custom domains, or
the API). The `z6o.cc` zone must be on the same account so the CNAME is created
automatically.

## Sync data from the box → serverless
`sync.py` mirrors the git-synced Go box's data into D1 + R2 (real titles +
freshest content, one-way, idempotent):
```bash
make sync-cf            # from the repo root
# or: cd cloudflare && python3 sync.py
```
It pulls every item from the box API (`SYNC_BOX_URL`, default
`https://scratchpad-suh.z6o.cc`), replaces the D1 index (items + links), and
re-uploads each `content/<id>` to R2. Creds/password come from
`../cloudflare_api_keys` (or env: `SCRATCHPAD_PASSWORD`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`). It's one-way (box → edge); items deleted on the box
disappear from D1 (their R2 blobs remain as harmless orphans).

## Local dev
```bash
wrangler pages dev ../web/dist        # emulates D1 + R2 locally
```
