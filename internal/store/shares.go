package store

import (
	"database/sql"
	"errors"
)

// Share is a view-only link to an item with an expiry (unix seconds).
type Share struct {
	Token     string `json:"token"`
	ItemID    string `json:"itemId"`
	ExpiresAt int64  `json:"expiresAt"`
	CreatedAt int64  `json:"createdAt"`
}

// CreateShare stores a new share token.
func (s *Store) CreateShare(sh Share) error {
	_, err := s.db.Exec(
		`INSERT INTO shares (token, item_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
		sh.Token, sh.ItemID, sh.ExpiresAt, sh.CreatedAt)
	return err
}

// GetShare looks up a share by token.
func (s *Store) GetShare(token string) (Share, error) {
	var sh Share
	err := s.db.QueryRow(
		`SELECT token, item_id, expires_at, created_at FROM shares WHERE token = ?`, token).
		Scan(&sh.Token, &sh.ItemID, &sh.ExpiresAt, &sh.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Share{}, ErrNotFound
	}
	return sh, err
}

// SharesForItem lists active (and expired) shares for an item, newest first.
func (s *Store) SharesForItem(itemID string) ([]Share, error) {
	rows, err := s.db.Query(
		`SELECT token, item_id, expires_at, created_at FROM shares WHERE item_id = ? ORDER BY created_at DESC`,
		itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Share
	for rows.Next() {
		var sh Share
		if err := rows.Scan(&sh.Token, &sh.ItemID, &sh.ExpiresAt, &sh.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, sh)
	}
	return out, rows.Err()
}

// DeleteShare revokes a share token.
func (s *Store) DeleteShare(token string) error {
	res, err := s.db.Exec(`DELETE FROM shares WHERE token = ?`, token)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteExpiredShares purges shares past their expiry as of `now` (unix seconds).
func (s *Store) DeleteExpiredShares(now int64) (int64, error) {
	res, err := s.db.Exec(`DELETE FROM shares WHERE expires_at < ?`, now)
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}
