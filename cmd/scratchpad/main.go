// Command scratchpad is the single-binary server: it loads config from .env,
// opens the SQLite index, reconciles it against the data dir, and serves the
// embedded React SPA, the JSON API, and (later) public share routes.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"scratchpad/internal/config"
	"scratchpad/internal/httpapi"
	"scratchpad/internal/items"
	"scratchpad/internal/store"
	"scratchpad/web"
)

func main() {
	cfg := config.Load(resolveEnvPath())

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer st.Close()

	svc := items.New(st, cfg.DataDir, nil) // git onChange hook wired in M6
	if err := svc.Reconcile(); err != nil {
		log.Fatalf("reconcile data dir: %v", err)
	}

	srvAPI, err := httpapi.NewServer(cfg, st, svc, web.Dist())
	if err != nil {
		log.Fatalf("init server: %v", err)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srvAPI.Router(),
		ReadHeaderTimeout: 10 * time.Second,
	}

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

// resolveEnvPath picks the config file: SCRATCHPAD_ENV, else .env, else
// what_i_need (so the app runs straight from bootstrap values during setup).
func resolveEnvPath() string {
	if p := os.Getenv("SCRATCHPAD_ENV"); p != "" {
		return p
	}
	if _, err := os.Stat(".env"); err == nil {
		return ".env"
	}
	return "what_i_need"
}
