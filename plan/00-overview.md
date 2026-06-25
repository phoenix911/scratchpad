# Slate — Overview

A single-user, self-hosted workspace to write/save code snippets, draw
diagrams, organize them in folders, sync everything to a private git repo, and
hand out expiring view-only share links. Designed to be **light on RAM** and
look **out of this world**.

## What it is
- **Code editor** — pastebin-like, but with a genuinely good editor
  (CodeMirror 6): syntax highlighting, language detection, autosave.
- **Diagrams** — the real Excalidraw, embedded. Drawings are **first-class
  items**: created, saved, organized, and **shared** exactly like code snippets.
- **Folders** — organize items in folders on the server.
- **Git sync** — the data folder is a git repo pushed to a private GitHub repo
  via a fine-grained PAT.
- **Share links** — view-only links, default valid **1 day**, max **30 days**,
  for both code snippets and Excalidraw drawings.
- **Gorgeous UI** — Apple-grade: deep neutral canvas, glass accents, ⌘K command
  palette, quiet spring motion.

## Confirmed decisions
- **Hosting:** home server / NAS, exposed for share links via a tunnel
  (Tailscale or Cloudflare Tunnel).
- **Git:** one private GitHub repo via fine-grained **PAT**.
- **Stack:** single **Go** binary (pure-Go SQLite + go-git, embeds the SPA)
  serving a **React** SPA (CodeMirror 6 + Excalidraw).
- **Deploy:** no Docker — run the binary directly on the NAS. All config
  (`PORT`, `GIT_URL`, `GIT_PAT`, password, …) comes from a `.env` file.

## Non-goals
- Multi-user accounts, roles, collaboration, real-time co-editing.
- Heavy auth (just a single-password gate; share routes are public).
- Anything that bloats server RAM (target idle RSS < 40 MB).

## Outcome
One small static binary you drop on the NAS, open in a browser, and it just
works — instant, light, beautiful.
