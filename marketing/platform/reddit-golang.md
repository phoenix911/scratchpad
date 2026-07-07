# r/golang

Lead with the Go architecture, not the product pitch. This sub wants design
choices.

**Title:** `Show & tell: a self-hosted workspace app — single Go binary embedding a React SPA, files-on-disk synced via system git`

> Built a little workspace app in Go. Things that might interest this sub:
>
> - `embed.FS` for the built React SPA, so it ships as one static binary that
>   *is* the web server (net/http + chi).
> - **pure-Go** SQLite (modernc) — no cgo, cross-compiles cleanly — used *only*
>   as a rebuildable index over files-on-disk. The filesystem is the source of
>   truth; on boot it reconciles the DB against the tree, so a lost/corrupt DB
>   just gets regenerated from the files.
> - Sync is `os/exec` shelling out to the system `git` (SSH or HTTPS) — no
>   embedded git lib, no SSH-in-Go. Version history is then just `git log`.
> - ~20 MB idle, instant boot.
>
> https://github.com/phoenix911/scratchpad — happy to discuss the design
> choices (and where shelling out to git bit me).
