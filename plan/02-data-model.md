# Slate — Data Model

## On-disk layout
`data/` **is** the git repo (remote = the private GitHub repo over HTTPS+PAT).
Content lives as real files so diffs read well; SQLite indexes them.

```
data/                              # git working tree (pushed to GitHub)
  items/
    <folder>/<slug>-<shortid>.<ext>        # code snippet, raw (.py/.ts/.sql…)
    <folder>/<slug>-<shortid>.excalidraw   # drawing = Excalidraw scene JSON
  .gitignore
app.db          # SQLite — lives OUTSIDE data/, never committed
.env            # PORT, GIT_URL, GIT_PAT, SLATE_PASSWORD, etc. — outside data/, gitignored
```

## Configuration (`.env`)
All config comes from an env file (loaded on boot; real environment variables
override it). No Docker, no `config.json` — the binary is exposed directly.

```dotenv
PORT=8080                 # port the Go server listens on
GIT_URL=https://github.com/<user>/<repo>.git
GIT_PAT=github_pat_xxx    # fine-grained PAT, Contents: Read & write
GIT_USER=<user>           # used to build the authed remote URL
SLATE_PASSWORD=...        # single-password gate (plaintext in env; hashed in memory)
DATA_DIR=./data           # optional; defaults to ./data
DB_PATH=./app.db          # optional; defaults to ./app.db
SHARE_BASE_URL=https://slate.example.com   # used to build share links (tunnel host)
```

- **Code snippets** are saved with their real extension so GitHub renders/diffs
  them nicely.
- **Drawings** are saved as `.excalidraw` — the standard Excalidraw scene JSON
  (`{type, version, elements, appState, files}`). This is what makes a drawing
  both git-trackable and directly shareable.
- `<shortid>` keeps filenames unique even if two items share a title.

## SQLite schema
All tables are rebuildable from disk **except `shares`** (the only durable
system-of-record table).

```sql
CREATE TABLE items (
  id          TEXT PRIMARY KEY,        -- short id
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,           -- 'code' | 'draw'
  path        TEXT NOT NULL,           -- relative path under data/items
  language    TEXT,                    -- for code items
  folder      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,        -- unix seconds
  updated_at  INTEGER NOT NULL
);

CREATE TABLE shares (
  token       TEXT PRIMARY KEY,        -- base58, crypto/rand
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,        -- unix seconds; clamped to [1d, 30d]
  created_at  INTEGER NOT NULL
);

CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL            -- repo url, last_sync, theme, etc.
);
```

## Reconcile on boot
1. `git Pull` into `data/`.
2. Walk `data/items/**`.
3. Upsert each file into `items` (id parsed from filename; type from extension;
   language from extension/sniff).
4. Delete `items` rows whose file no longer exists.
5. `shares` rows pointing at vanished items are cascade-cleaned.

This keeps the index correct after a pull brings in changes made elsewhere, and
lets you rebuild the whole DB by deleting `app.db` and restarting.
