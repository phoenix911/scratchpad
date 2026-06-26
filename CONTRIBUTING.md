# Contributing

Thanks for your interest in Scratchpad! It's a small, focused project — issues
and PRs are welcome.

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md). For security issues, see
[SECURITY.md](SECURITY.md) — please don't open public issues for vulnerabilities.

## Project layout

```
cmd/scratchpad/      # entrypoint (main.go)
internal/
  config/            # env/.env config
  store/             # SQLite index (items, shares, links, settings)
  items/             # file-backed items + folders + reconcile
  git/               # data-repo sync (shells out to git) + history
  og/                # share link preview images
  httpapi/           # chi router, auth, all HTTP handlers
web/                 # Vite + React + TS app (embedded into the binary)
  src/components/    # layout/ editors/ overlays/ ui/
  src/lib/           # api client, helpers
docs/                # documentation
site/                # landing page (GitHub Pages)
```

The Go binary embeds the built SPA via `embed.FS`, so a release is a single
static file.

## Prerequisites

- Go (see `go.mod` for the version) and Node 22+.

## Develop

Run the Go server and the Vite dev server side by side (the dev server proxies
`/api`, `/s` and `/healthz` to `:8080`):

```bash
go run ./cmd/scratchpad      # backend on :8080
make dev                     # frontend dev server (in another terminal)
```

## Build

```bash
make all     # build SPA -> embed -> ./scratchpad (single binary)
make cross   # cross-compile linux/amd64
```

## Before opening a PR

```bash
go build ./... && go vet ./... && go test ./...
cd web && npm run build
```

CI runs the same checks plus a smoke test that boots the binary and asserts the
app actually serves.

## Conventions

- Keep the binary small and the runtime light — avoid heavy dependencies.
- Frontend imports use the `@/` alias (`@/lib/...`, `@/components/...`).
- Match the surrounding code style; keep comments purposeful.
- Commit messages: short, lowercase, imperative ("add backlinks panel").

## Reporting bugs / requesting features

Use the issue templates. For security-sensitive reports, please open a minimal
issue and avoid posting exploit details publicly.
