package httpapi

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"runtime"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"scratchpad/internal/config"
	"scratchpad/internal/git"
	"scratchpad/internal/items"
	"scratchpad/internal/store"
)

// Server holds the dependencies shared by all HTTP handlers.
type Server struct {
	cfg   config.Config
	st    *store.Store
	items *items.Service
	sync  *git.Syncer
	auth  *authenticator
	dist  fs.FS
	spa   http.Handler
}

// NewServer wires the API. dist is the embedded SPA filesystem.
func NewServer(cfg config.Config, st *store.Store, svc *items.Service, syncer *git.Syncer, dist fs.FS) (*Server, error) {
	auth, err := newAuthenticator(cfg, st)
	if err != nil {
		return nil, err
	}
	return &Server{cfg: cfg, st: st, items: svc, sync: syncer, auth: auth, dist: dist, spa: SPAHandler(dist)}, nil
}

// Router builds the chi router with public + authed route groups.
func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// --- public ---
	r.Get("/healthz", s.handleHealth)
	r.Post("/api/login", s.auth.handleLogin)
	r.Post("/api/logout", s.auth.handleLogout)
	r.Get("/api/me", s.handleMe)
	// Public read-only share view (/s/:token is the SPA route that calls this).
	r.Get("/api/share/{token}", s.handlePublicShare)
	// Public share page (SPA HTML with injected OG tags) + the OG preview image.
	r.Get("/s/{token}", s.handleSharePage)
	r.Get("/og/{token}.png", s.handleOGImage)
	// Public uploaded images (embedded in docs / shared pages).
	r.Get("/assets/{name}", s.handleAsset)

	// --- authed API ---
	r.Group(func(r chi.Router) {
		r.Use(s.auth.require)
		r.Route("/api/items", func(r chi.Router) {
			r.Get("/", s.handleListItems)
			r.Post("/", s.handleCreateItem)
			r.Get("/{id}", s.handleGetItem)
			r.Put("/{id}", s.handleUpdateItem)
			r.Delete("/{id}", s.handleDeleteItem)
			r.Post("/{id}/share", s.handleCreateShare)
			r.Get("/{id}/shares", s.handleListShares)
			r.Get("/{id}/history", s.handleHistory)
			r.Get("/{id}/history/{hash}", s.handleHistoryVersion)
			r.Post("/{id}/restore", s.handleRestore)
			r.Get("/{id}/backlinks", s.handleBacklinks)
		})
		r.Delete("/api/shares/{token}", s.handleRevokeShare)
		r.Route("/api/folders", func(r chi.Router) {
			r.Get("/", s.handleListFolders)
			r.Post("/", s.handleFolderAction)
		})
		r.Post("/api/sync", s.handleSync)
		r.Get("/api/sync/status", s.handleSyncStatus)
		r.Post("/api/upload", s.handleUpload)
	})

	// --- SPA fallback (also serves login screen) ---
	r.Handle("/*", s.spa)
	return r
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":          true,
		"app":         s.cfg.AppName,
		"syncEnabled": s.cfg.SyncEnabled(),
		"heapBytes":   m.HeapAlloc,
	})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	if !s.auth.valid(r) {
		writeErr(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authed": true, "app": s.cfg.AppName})
}

// --- small JSON helpers shared across handlers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 16<<20)) // 16 MB cap
	return dec.Decode(v)
}
