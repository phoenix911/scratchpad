package store

import (
	"database/sql"
	"errors"
)

// Item is the index row for a saved snippet or drawing. Content lives on disk,
// not here — `path` points at the file under the data dir.
type Item struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Type      string `json:"type"` // "code" | "draw"
	Path      string `json:"path"`
	Language  string `json:"language"`
	Folder    string `json:"folder"`
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// UpsertItem inserts or replaces an item row (used by create, update, and
// disk→DB reconcile).
func (s *Store) UpsertItem(it Item) error {
	_, err := s.db.Exec(`
INSERT INTO items (id, title, type, path, language, folder, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title, type=excluded.type, path=excluded.path,
  language=excluded.language, folder=excluded.folder, updated_at=excluded.updated_at`,
		it.ID, it.Title, it.Type, it.Path, it.Language, it.Folder, it.CreatedAt, it.UpdatedAt)
	return err
}

// GetItem returns one item's metadata.
func (s *Store) GetItem(id string) (Item, error) {
	var it Item
	err := s.db.QueryRow(`
SELECT id, title, type, path, language, folder, created_at, updated_at
FROM items WHERE id = ?`, id).Scan(
		&it.ID, &it.Title, &it.Type, &it.Path, &it.Language, &it.Folder, &it.CreatedAt, &it.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	return it, err
}

// ListItems returns all items, newest first.
func (s *Store) ListItems() ([]Item, error) {
	rows, err := s.db.Query(`
SELECT id, title, type, path, language, folder, created_at, updated_at
FROM items ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Title, &it.Type, &it.Path, &it.Language,
			&it.Folder, &it.CreatedAt, &it.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

// DeleteItem removes an item row (shares cascade via FK).
func (s *Store) DeleteItem(id string) error {
	res, err := s.db.Exec(`DELETE FROM items WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// AllItemIDs returns the set of known item ids — used by reconcile to prune
// rows whose backing file has disappeared.
func (s *Store) AllItemIDs() (map[string]string, error) {
	rows, err := s.db.Query(`SELECT id, path FROM items`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]string{}
	for rows.Next() {
		var id, path string
		if err := rows.Scan(&id, &path); err != nil {
			return nil, err
		}
		out[id] = path
	}
	return out, rows.Err()
}
