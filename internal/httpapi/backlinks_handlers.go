package httpapi

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"scratchpad/internal/items"
	"scratchpad/internal/store"
)

type outgoingLink struct {
	Title string      `json:"title"`
	Item  *store.Item `json:"item"` // nil if the title doesn't resolve to an item yet
}

// handleBacklinks returns items linking TO this item (backlinks) and the items
// this one links out to (outgoing), based on [[wiki-link]] references.
func (s *Server) handleBacklinks(w http.ResponseWriter, r *http.Request) {
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

	back, err := s.st.BacklinkItems(fi.Title, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if back == nil {
		back = []store.Item{}
	}

	titles, _ := s.st.LinkTitles(id)
	outgoing := make([]outgoingLink, 0, len(titles))
	for _, t := range titles {
		link := outgoingLink{Title: t}
		if it, e := s.st.ItemByTitle(t); e == nil {
			link.Item = &it
		}
		outgoing = append(outgoing, link)
	}

	writeJSON(w, http.StatusOK, map[string]any{"backlinks": back, "outgoing": outgoing})
}
