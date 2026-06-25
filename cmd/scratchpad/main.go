// Command slate is the single-binary server: it loads config from .env, serves
// the embedded React SPA, the JSON API, and public share routes.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"scratchpad/internal/config"
	"scratchpad/internal/httpapi"
	"scratchpad/web"
)

func main() {
	// Resolve .env path (defaults to ./.env, but fall back to ./what_i_need so the
	// app runs straight from the values the user is filling in during bootstrap).
	envPath := os.Getenv("SLATE_ENV")
	if envPath == "" {
		if _, err := os.Stat(".env"); err == nil {
			envPath = ".env"
		} else {
			envPath = "what_i_need"
		}
	}
	cfg := config.Load(envPath)

	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)

	// Health check (public).
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		var m runtime.MemStats
		runtime.ReadMemStats(&m)
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":          true,
			"app":         cfg.AppName,
			"syncEnabled": cfg.SyncEnabled(),
			"heapBytes":   m.HeapAlloc,
		})
	})

	// SPA + static assets (catch-all). API and /s routes are added in later milestones.
	r.Handle("/*", httpapi.SPAHandler(web.Dist()))

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Graceful shutdown on SIGINT/SIGTERM.
	go func() {
		log.Printf("%s listening on :%s (sync=%v)", cfg.AppName, cfg.Port, cfg.SyncEnabled())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("bye")
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
