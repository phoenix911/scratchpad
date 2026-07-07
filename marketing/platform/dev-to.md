# dev.to

Paste the body below into dev.to (it accepts the front-matter block verbatim).
Cover image: upload `docs/assets/code.png` (or set a 100:42 banner). Tags max 4.

```markdown
---
title: "Everything I scratched down kept disappearing — so I built a workspace that actually keeps it"
published: false
description: "I kept losing notes, snippets and diagrams to closed tabs, unsaved drafts and device changes. So I built Scratchpad — a single self-hosted Go binary where everything is a real file, synced to a git repo you own."
tags: selfhosted, go, opensource, webdev
cover_image: https://raw.githubusercontent.com/phoenix911/scratchpad/main/docs/assets/code.png
# Use a ratio of 100:42 for best results.
canonical_url: https://phoenix911.github.io/scratchpad/
# published_at: 2026-06-27 19:34 +0000
---

I have lost more notes than I'd like to admit. Not to dramatic disk failures —
to the quiet, ordinary stuff. A snippet in a pastebin tab that I closed before
it saved. A diagram in some web tool I never made an account for, gone the
moment the tab reloaded. A folder of "temp" markdown files that stayed on the
old laptop when I switched machines. None of it felt important in the moment.
All of it I went looking for later, and couldn't find.

The pattern was always the same:

- **Scattered across too many tools.** A pastebin for code, a drawing app, a
  notes app, a doc editor, a kanban board — five tabs, five accounts, five
  silos. The thing I wanted was always in the one I wasn't looking at.
- **Never really saved.** Half these tools keep your work in browser state or a
  draft that only persists if you remember to hit save / sign in / export.
  Close the tab at the wrong moment and it's just… gone. No file, nothing to
  recover.
- **Bleeds away over time.** Every device change, every "I'll migrate that
  later," every dead startup that took my data down with it — a little more of
  my own thinking quietly lost. Five years of scratch work and I can show you
  almost none of it.

So I built the tool I wanted: one place for all of it, where **everything is a
real file the instant I type it**, and where the data outlives the app, the
tab, and the laptop.

It's called **Scratchpad** — a single Go binary that embeds a React app. No
database server, no Docker, no cloud account. Everything you create is a plain
file on disk, **continuously synced to a private git repo you own**, and
shareable as view-only links.

- **Repo:** https://github.com/phoenix911/scratchpad
- **Landing + docs:** https://phoenix911.github.io/scratchpad/
- **License:** MIT

![Scratchpad code editor](https://raw.githubusercontent.com/phoenix911/scratchpad/main/docs/assets/code.png)

## What it does

Six editors, one app:

- **Code** snippets — CodeMirror 6, with real language detection.
- **Drawings** — Excalidraw, saved as scene JSON.
- **Mindmaps** — Mind Elixir.
- **Rich-text docs** — Tiptap, with Markdown input rules and paste-an-image.
- **Kanban boards** — drag-and-drop with dnd-kit.
- **Cornell notes** — the cue / notes / summary study layout, with Markdown
  auto-formatting.

On top of that:

- **Folders** (nestable) to organize items — mirrored as real subdirectories in
  your data repo.
- **View-only share links** with optional expiry (1–30 days, or never), each
  with an auto-generated link-preview image.
- **Version history** — every item is git-tracked, so you can browse and restore
  any past version.
- **Backlinks** — `[[wiki-links]]` between items, with a "links to / linked
  from" panel.
- **⌘K command palette**, light/dark following your system, ~20–30 MB idle RAM.

![Mindmaps and boards](https://raw.githubusercontent.com/phoenix911/scratchpad/main/docs/assets/mindmap.png)

## The design: files on disk, git as the backbone

Every frustration above comes back to one thing — *where does the work actually
live?* In most tools the honest answer is "somewhere you don't control, until
you remember to save it somewhere you do." So I inverted it. In Scratchpad the
source of truth is **the filesystem**, not a database, and the safety net is
**git**.

When you create a code snippet, it's written to disk with the language's real
extension (`.go`, `.py`, …) as you type. A drawing is an `.excalidraw` JSON
file. A doc is HTML. Those files live in a directory that *is* a git working
tree, and Scratchpad shells out to the system `git` to commit and push them to a
private repo you own (SSH or HTTPS).

That single choice answers each of the three frustrations directly:

- **"Never really saved" → it's a file before you look away.** There's no draft
  state to lose. Autosave writes to disk; the only place your work can be is a
  real file. Close the tab, kill the process, pull the plug — it's already on
  disk and already committed.
- **"Bleeds away over time" → the data outlives the app and the device.** Your
  repo *is* the backup. New laptop? `git clone` and you're whole again. Bored of
  Scratchpad in two years? You're left with a folder of normal files in normal
  formats — code, JSON, HTML, Markdown — readable with or without this tool.
  Zero lock-in, by construction.
- **"Scattered across tools" → one repo holds all of it.** Code, diagrams,
  mindmaps, docs and boards land in the *same* versioned tree, in folders you
  organize.

And because it's git, you get **full version history for free** — no custom
versioning code, it's `git log` and `git show` under the hood, so you can browse
and restore any past version of anything.

So where does SQLite come in? Only as a **rebuildable index**. It's a pure-Go
SQLite (`modernc.org/sqlite`, so no cgo) that caches item metadata and the
backlink graph for fast queries. On boot, Scratchpad reconciles the DB against
what's actually on disk — so if the DB is ever lost or out of sync, it's
regenerated from the files. The files win, always.

## Why a single Go binary

The whole app ships as one static binary:

- The built React SPA is embedded with `embed.FS`, so there's nothing to serve
  separately — the binary *is* the web server (net/http + chi).
- Pure-Go SQLite means no cgo, so it cross-compiles cleanly to linux/amd64,
  arm, etc. with a plain `GOOS`/`GOARCH`.
- Sync is just `os/exec` calling the `git` you already have installed — no
  embedded git library, no SSH-in-Go complexity.

The result boots instantly and sits around 20–30 MB of RAM. You can `scp` it to
a $5 VPS or a Raspberry Pi and run it under systemd.

## Self-hosting it

Grab a release binary (or `make all` from source) and run it:

```bash
git clone https://github.com/phoenix911/scratchpad
cd scratchpad
make all          # builds the SPA, embeds it, produces ./scratchpad
./scratchpad      # http://localhost:8080
```

Configuration is all environment variables (or a `.env` file). The ones that
matter:

| Variable | What it does |
|---|---|
| `SCRATCHPAD_PASSWORD` | Single-password gate (blank = open, local only) |
| `GIT_URL` | The private repo to sync your data to |
| `SHARE_BASE_URL` | Your public URL, used to build share links |
| `DATA_DIR` | Where the item files (the git working tree) live |

It's a personal, single-user tool behind one password. Put it behind any
reverse proxy or tunnel — Caddy, nginx, Cloudflare Tunnel, Tailscale — so the
share links work from anywhere. I run mine behind a Cloudflare Tunnel; there's
a sample systemd unit in the deployment docs.

## What's under the hood

- **Backend:** Go, net/http + chi, `embed.FS`, pure-Go SQLite, HMAC-signed
  session cookies, OG share-image rendering with the Go `image` libraries.
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 + Zustand, with the
  heavy editors code-split via `React.lazy`.
- **Editors:** CodeMirror, Excalidraw, Mind Elixir, Tiptap, dnd-kit.

## Try it / tear it apart

I've been running it for a while now, and the nice part is the thing I built it
for: I haven't lost a scratch note since. It's all just sitting in a repo,
across every machine I've moved to.

It's open source under MIT and I'd genuinely like feedback — especially from
people who've lost work the same dumb ways I have. What would it take before
you'd trust a tool with the stuff you scribble down?

- **Code:** https://github.com/phoenix911/scratchpad
- **Docs & screenshots:** https://phoenix911.github.io/scratchpad/

(I'm the dev — happy to answer anything about the architecture in the comments.)
```
