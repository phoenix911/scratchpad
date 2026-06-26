package httpapi

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

const maxUploadBytes = 10 << 20 // 10 MB

var imageExt = map[string]string{
	"image/png":     "png",
	"image/jpeg":    "jpg",
	"image/gif":     "gif",
	"image/webp":    "webp",
	"image/svg+xml": "svg",
	"image/avif":    "avif",
}

// handleUpload stores a pasted/dropped image under <data>/assets and returns its
// public URL. Images live in the data repo so they sync and resolve in shares.
func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	ct := strings.SplitN(r.Header.Get("Content-Type"), ";", 2)[0]
	ext, ok := imageExt[strings.TrimSpace(ct)]
	if !ok {
		writeErr(w, http.StatusUnsupportedMediaType, "only images are supported")
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, maxUploadBytes))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "read failed")
		return
	}

	dir := filepath.Join(s.cfg.DataDir, "assets")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	name := newShareToken() + "." + ext
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	s.sync.Schedule() // commit the asset with the next sync
	writeJSON(w, http.StatusCreated, map[string]string{"url": "/assets/" + name})
}

// handleAsset serves an uploaded image. PUBLIC — shared docs embed these. The
// name is a single path segment (no traversal); directory listing is disallowed.
func (s *Server) handleAsset(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" || strings.ContainsAny(name, "/\\") || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(s.cfg.DataDir, "assets", name)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, path)
}
