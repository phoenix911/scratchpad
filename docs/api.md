# HTTP API

All `/api/*` routes require a valid session cookie. `/s/:token`, `/uploads/:name`,
`/og/:token.png`, `/api/share/:token` and `/healthz` are **public**.

## Auth

```
POST   /api/login      { password }    → sets httpOnly session cookie
POST   /api/logout
GET    /api/me                         → { authed, app } | 401
```

## Items (all types)

```
GET    /api/items                      → { items: [...] }   (metadata only)
POST   /api/items                      { type, title, folder?, language?, content }
GET    /api/items/:id                  → { ...meta, content }
PUT    /api/items/:id                  { title?, folder?, language?, content? }
POST   /api/items/:id/state            { state: "active" | "archived" | "trashed" }
DELETE /api/items/:id                  (permanent delete — from the recycle bin)
```
`type` is one of `code | draw | mind | doc | kanban | cornell | sticky`. `content`
is the editor's serialized form (source text; Excalidraw / Mind Elixir / Kanban /
sticky-board JSON; or doc HTML).

## Folders

```
POST   /api/folders    { action: "create" | "rename" | "delete", name, newName? }
GET    /api/folders    → { folders: [...] }
```

## Sharing

```
POST   /api/items/:id/share    { ttlDays }  → { token, url, expiresAt }
                               ttlDays 0/absent = never; 1–30 = days
GET    /api/items/:id/shares
DELETE /api/shares/:token
GET    /api/share/:token       (PUBLIC) → { type, title, language, content }  | 404/410
```

## History & backlinks

```
GET    /api/items/:id/history          → { commits: [...] }
GET    /api/items/:id/history/:hash     → { content }   (file at that commit)
POST   /api/items/:id/restore           { hash }
GET    /api/items/:id/backlinks        → { backlinks: [...], outgoing: [...] }
```

## Uploads & sync

```
POST   /api/upload                     (image body) → { url: "/uploads/<file>" }
POST   /api/sync                       → pull + commit + push, returns status
GET    /api/sync/status                → { enabled, state, lastSync, message }
```

## Public pages

```
GET    /s/:token        SPA page with server-injected Open Graph tags
GET    /og/:token.png   1200×630 share-link preview image
GET    /uploads/:name   uploaded image
GET    /healthz         → { ok, app, syncEnabled, heapBytes }
```
