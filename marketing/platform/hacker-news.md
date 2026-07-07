# Hacker News — Show HN

Disclose you're the dev. Keep it plain; HN dislikes marketing tone.

**Title:** `Show HN: Scratchpad – self-hosted workspace where every note is a real file in your git repo`

> I kept losing scratch work the dumb ways: a snippet in a pastebin tab I closed
> before it saved, a diagram in a web tool gone on reload, a folder of "temp"
> markdown left behind on an old laptop after a device switch. Five years of it,
> and I can show you almost none.
>
> So I built Scratchpad: one place for code, drawings, mindmaps, docs and kanban
> boards, where the source of truth is the filesystem, not a database.
> Everything is a real file the instant you type it, autosaved and committed to
> a private git repo you own. New laptop = `git clone` and you're whole; drop
> the app entirely and you're left with normal files in normal formats.
>
> It's a single Go binary that embeds a React app (no DB server, no Docker).
> Editors: code (CodeMirror), drawings (Excalidraw), mindmaps (Mind Elixir),
> docs (Tiptap), kanban (dnd-kit) and Cornell notes. Version history is just
> git; plus `[[backlinks]]`, paste-an-image, and expiring view-only share
> links. ~20–30 MB idle RAM.
>
> Code: https://github.com/phoenix911/scratchpad
> Docs/landing: https://phoenix911.github.io/scratchpad/
>
> Happy to discuss the architecture — pure-Go SQLite (modernc) as a rebuildable
> index over files-on-disk, reconciled against the tree on boot, and sync that
> just shells out to the system `git`.
