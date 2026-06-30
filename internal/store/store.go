// Package store is the SQLite layer: schema, migrations, and access to the
// items / shares / settings tables. It knows nothing about files on disk —
// the items service owns that and uses this as its index.
package store

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "modernc.org/sqlite" // pure-Go driver, registered as "sqlite"
)

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("not found")

// Store wraps the SQLite connection.
type Store struct {
	db *sql.DB
}

// Open opens (creating if needed) the SQLite database at path and runs migrations.
func Open(path string) (*Store, error) {
	// _pragma options: WAL for concurrent reads, busy_timeout to avoid lock errors,
	// foreign_keys for the shares->items cascade.
	dsn := fmt.Sprintf("file:%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1) // single writer keeps things simple and lock-free for this workload
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

// Close closes the underlying database.
func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	const schema = `
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,            -- 'code' | 'draw'
  path        TEXT NOT NULL,            -- relative path under data/items
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
  expires_at  INTEGER NOT NULL,
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
`
	if _, err := s.db.Exec(schema); err != nil {
		return err
	}
	// Upgrade older databases that predate these columns. SQLite has no
	// "ADD COLUMN IF NOT EXISTS", so we ignore the duplicate-column error.
	for _, col := range []string{
		`ALTER TABLE items ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE items ADD COLUMN trashed INTEGER NOT NULL DEFAULT 0`,
	} {
		if _, err := s.db.Exec(col); err != nil && !strings.Contains(err.Error(), "duplicate column") {
			return err
		}
	}
	return nil
}
