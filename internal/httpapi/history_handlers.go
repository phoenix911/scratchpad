package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/phoenix911/scratchpad/internal/git"
	"github.com/phoenix911/scratchpad/internal/items"
)

// handleHistory lists the commits that touched an item's file.
func (s *Server) handleHistory(w http.ResponseWriter, r *http.Request) {
	fi, err := s.items.Get(chi.URLParam(r, "id"))
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	commits, err := git.History(s.cfg.DataDir, fi.Path, 100)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if commits == nil {
		commits = []git.Commit{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"commits": commits, "syncEnabled": s.cfg.SyncEnabled()})
}

// handleHistoryVersion returns the item's content as of a commit.
func (s *Server) handleHistoryVersion(w http.ResponseWriter, r *http.Request) {
	fi, err := s.items.Get(chi.URLParam(r, "id"))
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	content, err := git.FileAtCommit(s.cfg.DataDir, chi.URLParam(r, "hash"), fi.Path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"content": content})
}

// handleRestore writes a past version back as the current content.
func (s *Server) handleRestore(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	fi, err := s.items.Get(id)
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	var body struct {
		Hash string `json:"hash"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	content, err := git.FileAtCommit(s.cfg.DataDir, body.Hash, fi.Path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	updated, err := s.items.Update(id, items.UpdateInput{Content: &content})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, updated)
}
