# Data model

## On disk

`DATA_DIR` is the git working tree. Items are real files; the SQLite DB and
`.env` live outside it so they're never committed.

```
DATA_DIR/
  items/
    <folder>/<slug>-<id>.<ext>      # one file per item
  assets/<token>.<ext>              # pasted images
  .gitignore
scratchpad.db                       # SQLite index — OUTSIDE DATA_DIR
.env                                # secrets — OUTSIDE DATA_DIR
```

Extensions encode the type: code uses its language extension (`.go`, `.py`, …),
drawings `.excalidraw`, mindmaps `.mind`, docs `.doc` (HTML), boards `.kanban`
(JSON). The `<id>` keeps filenames unique.

## SQLite tables

All rebuildable from disk **except `shares`** (and the generated session secret
in `settings`).

```sql
items(    id, title, type, path, language, folder, created_at, updated_at )
shares(   token, item_id, expires_at, created_at )   -- expires_at = 0 means never
links(    from_id, to_title )                         -- [[wiki-link]] graph
settings( key, value )                                -- session secret, etc.
```

## Reconcile

On boot (after a git pull), Scratchpad walks `DATA_DIR/items`, upserts each file
into `items`, rebuilds the `links` index, and prunes rows whose file is gone. So
the index always reflects what's on disk — including changes pulled from another
machine.
