.PHONY: all web build run dev tidy clean cross \
        deploy deploy-build release \
        remote-status remote-logs remote-restart remote-health

BIN := scratchpad
PKG := ./cmd/scratchpad

# --- deploy config (override on the CLI, e.g. `make deploy DEPLOY_HOST=dell-box-lan`) ---
# NB: no trailing inline comments on these — Make would keep the spaces in the value.
DEPLOY_HOST ?= dell-box
DEPLOY_DIR  ?= /opt/scratchpad
DEPLOY_USER ?= scratchpad
DEPLOY_SVC  ?= scratchpad
DEPLOY_PORT ?= 6005
AMD64_BIN   := $(BIN)-linux-amd64
VERSION     := $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

# Build everything: SPA first (so embed.FS has real assets), then the binary.
all: web build

# Build the React SPA into web/dist (embedded by the Go binary).
web:
	cd web && npm install && npm run build

# Build the single Go binary (expects web/dist to already exist).
build:
	go build -trimpath -ldflags="-s -w" -o $(BIN) $(PKG)

# Cross-compile for the NAS (linux/arm64). Override GOOS/GOARCH as needed.
cross:
	GOOS=linux GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o $(BIN)-linux-arm64 $(PKG)

# Run the built binary.
run: build
	./$(BIN)

# Frontend dev server with API proxy (fast iteration; not the embedded build).
dev:
	cd web && npm run dev

tidy:
	go mod tidy

clean:
	rm -f $(BIN) $(BIN)-linux-arm64 $(AMD64_BIN)
	rm -rf web/dist

# ── deploy ──────────────────────────────────────────────────────────────────
# `make deploy` builds the SPA, cross-compiles a linux/amd64 binary, ships it to
# $(DEPLOY_HOST), installs it as the service user, records the version, restarts
# the systemd service and health-checks it. Needs ssh access + passwordless sudo
# on the host (as configured for dell-box).

# Build the SPA then cross-compile the server for the Dell box (linux/amd64).
deploy-build: web
	GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o $(AMD64_BIN) $(PKG)

deploy: deploy-build
	@echo "→ deploying $(VERSION) to $(DEPLOY_HOST):$(DEPLOY_DIR)"
	scp $(AMD64_BIN) $(DEPLOY_HOST):/tmp/$(BIN).new
	ssh $(DEPLOY_HOST) 'set -e; \
	  sudo install -o $(DEPLOY_USER) -g $(DEPLOY_USER) -m 0755 /tmp/$(BIN).new $(DEPLOY_DIR)/$(BIN); \
	  rm -f /tmp/$(BIN).new; \
	  echo "$(VERSION)" | sudo tee $(DEPLOY_DIR)/.version >/dev/null; \
	  sudo systemctl restart $(DEPLOY_SVC); \
	  for i in $$(seq 1 20); do curl -fsS -o /dev/null http://127.0.0.1:$(DEPLOY_PORT)/healthz && break || sleep 0.5; done; \
	  curl -fsS http://127.0.0.1:$(DEPLOY_PORT)/healthz && echo " ✓ deployed $(VERSION)"'

# Cut a versioned GitHub Release instead (CI builds + publishes the binary). Use
# this when you want a tracked release artifact; `make deploy` is the fast path.
release:
	git tag -a "v0.2.$$(date +%y%m%d%H%M%S)" -m "release" && git push origin --tags

# Remote control shortcuts (mirror the on-box Makefile).
remote-status:  ; ssh $(DEPLOY_HOST) 'systemctl --no-pager status $(DEPLOY_SVC) | head -15'
remote-logs:    ; ssh $(DEPLOY_HOST) 'journalctl -u $(DEPLOY_SVC) -n 200 -f'
remote-restart: ; ssh $(DEPLOY_HOST) 'sudo systemctl restart $(DEPLOY_SVC) && echo restarted'
remote-health:  ; ssh $(DEPLOY_HOST) 'curl -fsS http://127.0.0.1:$(DEPLOY_PORT)/healthz && echo'
