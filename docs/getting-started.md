# Getting started

Scratchpad is a single binary. You can run a release binary or build from source.

## Run a release

Download the binary for your platform from
[Releases](https://github.com/phoenix911/scratchpad/releases), then:

```bash
chmod +x scratchpad-linux-amd64
./scratchpad-linux-amd64        # serves on http://localhost:8080
```

## Build from source

Requires Go (see `go.mod`) and Node 22+.

```bash
git clone https://github.com/phoenix911/scratchpad
cd scratchpad
make all       # builds the SPA, embeds it, produces ./scratchpad
./scratchpad
```

Open <http://localhost:8080>.

## First run

- With **no** `SCRATCHPAD_PASSWORD` set, the app runs open — fine for localhost.
- Create items with **⌘K** (or Ctrl-K): snippet, drawing, mindmap, doc, board.
- Everything is written to `./data/items/…` as plain files, indexed in
  `./scratchpad.db` (a rebuildable SQLite cache).

## Configure

Copy the example env file and edit:

```bash
cp .env.example .env
```

Set at least `SCRATCHPAD_PASSWORD` if the app will be reachable beyond localhost.
See [configuration.md](configuration.md) for every option, and
[git-sync.md](git-sync.md) to back your data up to a private git repo.

## Develop

```bash
go run ./cmd/scratchpad     # backend on :8080
make dev                    # Vite dev server (proxies /api to :8080)
```
