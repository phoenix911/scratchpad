-- D1 schema for the Cloudflare-native deployment. Mirrors the Go app's SQLite
-- index (internal/store/store.go). Unlike the Go app, D1 is authoritative for
-- metadata here (item content lives in R2 under content/<id>).

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,            -- code | draw | mind | doc | kanban | cornell | sticky | wf
  path        TEXT NOT NULL,            -- logical path (kept for parity; not a real fs path)
  language    TEXT NOT NULL DEFAULT '',
  folder      TEXT NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  trashed     INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_folder ON items(folder);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at DESC);

CREATE TABLE IF NOT EXISTS shares (
  token       TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,         -- 0 = never
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shares_item ON shares(item_id);

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  from_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_title    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_title);
CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_id);
