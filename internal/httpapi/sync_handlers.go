package httpapi

import "net/http"

// handleSync runs an immediate pull + commit + push, re-indexes any pulled
// changes, and returns the new status.
func (s *Server) handleSync(w http.ResponseWriter, _ *http.Request) {
	err := s.sync.SyncNow()
	// Reconcile regardless: a pull may have brought in files even if push failed.
	_ = s.items.Reconcile()
	_ = err // the error is reflected in Status().state
	writeJSON(w, http.StatusOK, s.sync.Status())
}

// handleSyncStatus reports the current sync state for the UI pill.
func (s *Server) handleSyncStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, s.sync.Status())
}
