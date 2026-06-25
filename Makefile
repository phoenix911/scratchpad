.PHONY: all web build run dev tidy clean cross

BIN := scratchpad
PKG := ./cmd/scratchpad

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
	rm -f $(BIN) $(BIN)-linux-arm64
	rm -rf web/dist
