package httpapi

import "net/http"

func (s *Server) handleListFolders(w http.ResponseWriter, _ *http.Request) {
	folders, err := s.items.Folders()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if folders == nil {
		folders = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"folders": folders})
}

// handleFolderAction handles create / rename / delete via a single endpoint.
func (s *Server) handleFolderAction(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Action  string `json:"action"` // create | rename | delete
		Name    string `json:"name"`
		NewName string `json:"newName"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, "bad request")
		return
	}

	switch body.Action {
	case "create":
		path, err := s.items.CreateFolder(body.Name)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"folder": path})
	case "rename":
		path, err := s.items.RenameFolder(body.Name, body.NewName)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"folder": path})
	case "delete":
		if err := s.items.DeleteFolder(body.Name); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	default:
		writeErr(w, http.StatusBadRequest, "unknown action")
	}
}
