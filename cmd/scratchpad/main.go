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

	"github.com/phoenix911/scratchpad/internal/config"
	"github.com/phoenix911/scratchpad/internal/git"
	"github.com/phoenix911/scratchpad/internal/httpapi"
	"github.com/phoenix911/scratchpad/internal/items"
	"github.com/phoenix911/scratchpad/internal/store"
	"github.com/phoenix911/scratchpad/web"
)

func main() {
	cfg := config.Load(resolveEnvPath())

	st, err := store.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer st.Close()

	// Git sync (best-effort). EnsureRepo + Pull bring in any remote changes
	// before we reconcile the index against the data dir.
	syncer, err := git.New(cfg)
	if err != nil {
		log.Fatalf("init git: %v", err)
	}
	if err := syncer.EnsureRepo(); err != nil {
		log.Printf("git: ensure repo failed (continuing local-only): %v", err)
	} else if err := syncer.Pull(); err != nil {
		log.Printf("git: pull failed (continuing): %v", err)
	}

	// Every item/folder mutation schedules a debounced commit+push.
	svc := items.New(st, cfg.DataDir, syncer.Schedule)
	if err := svc.Reconcile(); err != nil {
		log.Fatalf("reconcile data dir: %v", err)
	}

	srvAPI, err := httpapi.NewServer(cfg, st, svc, syncer, web.Dist())
	if err != nil {
		log.Fatalf("init server: %v", err)
	}

	srv := &http.Server{
		Addr:              cfg.Bind + ":" + cfg.Port,
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

// resolveEnvPath picks the config file: $SCRATCHPAD_ENV if set, else ./.env.
// Real environment variables always override file values, so the file is
// optional (e.g. when everything is passed via systemd/EnvironmentFile).
func resolveEnvPath() string {
	if p := os.Getenv("SCRATCHPAD_ENV"); p != "" {
		return p
	}
	return ".env"
}
