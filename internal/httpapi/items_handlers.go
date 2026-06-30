package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/phoenix911/scratchpad/internal/items"
	"github.com/phoenix911/scratchpad/internal/store"
)

func (s *Server) handleListItems(w http.ResponseWriter, _ *http.Request) {
	list, err := s.items.List()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if list == nil {
		list = []store.Item{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": list})
}

func (s *Server) handleCreateItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Type     string `json:"type"`
		Title    string `json:"title"`
		Folder   string `json:"folder"`
		Language string `json:"language"`
		Content  string `json:"content"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	fi, err := s.items.Create(items.CreateInput{
		Type: body.Type, Title: body.Title, Folder: body.Folder,
		Language: body.Language, Content: body.Content,
	})
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, fi)
}

func (s *Server) handleGetItem(w http.ResponseWriter, r *http.Request) {
	fi, err := s.items.Get(chi.URLParam(r, "id"))
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, fi)
}

func (s *Server) handleUpdateItem(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title    *string `json:"title"`
		Folder   *string `json:"folder"`
		Language *string `json:"language"`
		Content  *string `json:"content"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	fi, err := s.items.Update(chi.URLParam(r, "id"), items.UpdateInput{
		Title: body.Title, Folder: body.Folder, Language: body.Language, Content: body.Content,
	})
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, fi)
}

// handleSetItemState moves an item between active / archived / recycle-bin
// states (the file moves between items/, archive/ and trash/ on disk).
func (s *Server) handleSetItemState(w http.ResponseWriter, r *http.Request) {
	var body struct {
		State string `json:"state"` // active | archived | trashed
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}
	id := chi.URLParam(r, "id")
	var err error
	switch body.State {
	case "active":
		_, err = s.items.Restore(id)
	case "archived":
		_, err = s.items.Archive(id, true)
	case "trashed":
		err = s.items.Delete(id)
	default:
		writeErr(w, http.StatusBadRequest, "unknown state")
		return
	}
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteItem permanently removes an item (used from the recycle bin).
func (s *Server) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	err := s.items.Purge(chi.URLParam(r, "id"))
	if errors.Is(err, items.ErrNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
