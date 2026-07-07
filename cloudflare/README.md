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

## Local dev
```bash
wrangler pages dev ../web/dist        # emulates D1 + R2 locally
```
