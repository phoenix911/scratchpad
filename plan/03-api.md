# Slate — API

All `/api/*` routes require a valid session cookie. `/s/:token` and `/healthz`
are public.

## Auth
```
POST /api/login    { password }            → sets httpOnly session cookie
POST /api/logout                            → clears cookie
GET  /api/me                                → { authed: true } | 401
```
Single password from `SLATE_PASSWORD` (`.env`), hashed in memory at boot.
Session = signed cookie.

## Items (code snippets AND drawings)
```
POST   /api/items        { type:'code'|'draw', title, folder?, language?, content }
                         → { id, path, ... }       (content = code text OR scene JSON)
GET    /api/items        → tree: folders + items (metadata only)
GET    /api/items/:id    → { ...meta, content }
PUT    /api/items/:id    { title?, folder?, language?, content? }   → updated meta
                         (writes file, updates index, schedules git sync)
DELETE /api/items/:id    → 204
```
Drawings use the same endpoints — `type:'draw'`, `content` is the Excalidraw
scene JSON. There is no separate drawing API; one item model covers both.

## Folders
```
POST   /api/folders      { action:'create'|'rename'|'delete', name, newName? }
```

## Sharing (works for both code and drawings)
```
POST   /api/items/:id/share   { ttlDays }    → { token, url, expiresAt }
                              ttlDays clamped to [1, 30]; default 1
DELETE /api/shares/:token                     → 204 (revoke)
GET    /api/items/:id/shares                  → active shares for an item
```

## Sync
```
POST /api/sync           → manual pull + push; returns { lastSync, status }
GET  /api/sync/status    → { state:'idle'|'syncing'|'conflict'|'error', lastSync }
```

## Public share view
```
GET /s/:token
  - not found / revoked  → 404
  - expired              → 410 Gone
  - ok                   → serves the SPA share route with embedded payload:
                           { type, title, language?, content }
```
The SPA's `ShareView` renders:
- `type:'code'` → CodeMirror in **read-only** mode.
- `type:'draw'` → Excalidraw with **`viewModeEnabled: true`** (pan/zoom, no edit).

### Link unfurls (Open Graph)
```
GET /s/:token       → SPA index.html with server-injected OG/Twitter meta
GET /og/:token.png  → 1200×630 PNG: a random SFW funny caption + the item title
```
The page route injects `og:title`/`og:description`/`og:image` (+ `twitter:card`)
into `<head>` server-side so crawlers see them without running JS. The image is
generated in-process (`internal/og`, Go built-in fonts — no external assets); the
caption is chosen deterministically from the token, so a link's preview is stable.

## Health
```
GET /healthz → 200 { ok:true, rssBytes }
```
