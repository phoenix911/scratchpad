package store

import (
	"database/sql"
	"errors"
)

// SetLinks replaces the outgoing [[wiki-link]] targets for an item.
func (s *Store) SetLinks(fromID string, titles []string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	if _, err := tx.Exec(`DELETE FROM links WHERE from_id = ?`, fromID); err != nil {
		return err
	}
	for _, t := range titles {
		if t == "" {
			continue
		}
		if _, err := tx.Exec(`INSERT INTO links (from_id, to_title) VALUES (?, ?)`, fromID, t); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// LinkTitles returns the titles an item links out to.
func (s *Store) LinkTitles(fromID string) ([]string, error) {
	rows, err := s.db.Query(`SELECT to_title FROM links WHERE from_id = ?`, fromID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// BacklinkItems returns items that link TO the given title (case-insensitive),
// excluding the item itself.
func (s *Store) BacklinkItems(title, selfID string) ([]Item, error) {
	rows, err := s.db.Query(`
SELECT DISTINCT i.id, i.title, i.type, i.path, i.language, i.folder, i.created_at, i.updated_at
FROM items i JOIN links l ON l.from_id = i.id
WHERE lower(l.to_title) = lower(?) AND i.id != ?
ORDER BY i.updated_at DESC`, title, selfID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanItems(rows)
}

// ItemByTitle resolves a title to an item (case-insensitive). Returns
// ErrNotFound if none match.
func (s *Store) ItemByTitle(title string) (Item, error) {
	var it Item
	err := s.db.QueryRow(`
SELECT id, title, type, path, language, folder, created_at, updated_at
FROM items WHERE lower(title) = lower(?) LIMIT 1`, title).Scan(
		&it.ID, &it.Title, &it.Type, &it.Path, &it.Language, &it.Folder, &it.CreatedAt, &it.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	return it, err
}

func scanItems(rows *sql.Rows) ([]Item, error) {
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
