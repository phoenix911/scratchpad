package httpapi

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"scratchpad/internal/items"
	"scratchpad/internal/store"
)

const (
	shareTTLMinDays = 1
	shareTTLMaxDays = 30
)

// handleCreateShare mints a view-only token for an item. ttlDays defaults to 1
// and is clamped to [1, 30].
func (s *Server) handleCreateShare(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := s.items.Get(id); err != nil {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}

	var body struct {
		TTLDays int `json:"ttlDays"`
	}
	_ = decodeJSON(r, &body) // empty body is fine → never expires

	// ttlDays <= 0 means "never" (expires_at = 0); a positive value is clamped
	// to [1, 30] days. Never is the default.
	now := time.Now()
	var expiresAt int64 // 0 = never
	if body.TTLDays > 0 {
		days := body.TTLDays
		if days < shareTTLMinDays {
			days = shareTTLMinDays
		}
		if days > shareTTLMaxDays {
			days = shareTTLMaxDays
		}
		expiresAt = now.Add(time.Duration(days) * 24 * time.Hour).Unix()
	}
	sh := store.Share{
		Token:     newShareToken(),
		ItemID:    id,
		ExpiresAt: expiresAt,
		CreatedAt: now.Unix(),
	}
	if err := s.st.CreateShare(sh); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"token":     sh.Token,
		"url":       s.shareURL(sh.Token),
		"expiresAt": sh.ExpiresAt,
	})
}

// handleListShares returns active shares for an item, pruning expired ones first.
func (s *Server) handleListShares(w http.ResponseWriter, r *http.Request) {
	_, _ = s.st.DeleteExpiredShares(time.Now().Unix())
	shares, err := s.st.SharesForItem(chi.URLParam(r, "id"))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]map[string]any, 0, len(shares))
	for _, sh := range shares {
		out = append(out, map[string]any{
			"token":     sh.Token,
			"url":       s.shareURL(sh.Token),
			"expiresAt": sh.ExpiresAt,
			"createdAt": sh.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"shares": out})
}

// handleRevokeShare deletes a share token.
func (s *Server) handleRevokeShare(w http.ResponseWriter, r *http.Request) {
	err := s.st.DeleteShare(chi.URLParam(r, "token"))
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handlePublicShare serves a shared item read-only. PUBLIC — no auth. Returns
// 404 if unknown/revoked, 410 if expired.
func (s *Server) handlePublicShare(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	sh, err := s.st.GetShare(token)
	if errors.Is(err, store.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if sh.ExpiresAt != 0 && time.Now().Unix() >= sh.ExpiresAt {
		_ = s.st.DeleteShare(token)
		writeErr(w, http.StatusGone, "this link has expired")
		return
	}
	fi, err := s.items.Get(sh.ItemID)
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"type":      fi.Type,
		"title":     fi.Title,
		"language":  fi.Language,
		"content":   fi.Content,
		"expiresAt": sh.ExpiresAt,
	})
}

// shareURL builds the absolute share link from SHARE_BASE_URL, or a relative
// path if no base is configured.
func (s *Server) shareURL(token string) string {
	base := s.cfg.ShareBaseURL
	if base == "" {
		return "/s/" + token
	}
	if !strings.HasPrefix(base, "http://") && !strings.HasPrefix(base, "https://") {
		base = "https://" + base
	}
	return strings.TrimRight(base, "/") + "/s/" + token
}

// newShareToken returns a 16-char lowercase base32 token (10 random bytes).
func newShareToken() string {
	var b [10]byte
	_, _ = rand.Read(b[:])
	return strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:]))
}
