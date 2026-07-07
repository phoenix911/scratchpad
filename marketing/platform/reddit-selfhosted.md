# r/selfhosted

Disclose you're the dev. Lead with the data-ownership angle — that's what this
sub cares about.

**Title:** `I kept losing notes to closed tabs and device changes, so I built a self-hosted workspace where everything is a file in your own git repo`

> Hey r/selfhosted — I made **Scratchpad**. The itch: I kept losing scratch work
> the ordinary ways — a snippet in a pastebin tab closed before it saved, a
> diagram gone on reload, "temp" files left behind on the old laptop after every
> device switch. I wanted one place for all of it that I actually owned.
>
> So: one small Go binary you run on your server, with six editors in one app
> (code, Excalidraw drawings, mindmaps, rich-text docs, kanban, Cornell notes).
> MIT, no Docker required, ~20 MB RAM.
>
> The part you'll care about: **your data is just files**, autosaved and
> continuously synced to a *private git repo you own*. So backup, full version
> history, and recovery come for free, and there's zero lock-in — new machine is
> just a `git clone`, and dropping the app leaves you a folder of normal files.
> View-only share links have optional expiry.
>
> Repo: https://github.com/phoenix911/scratchpad · screenshots + docs:
> https://phoenix911.github.io/scratchpad/
>
> It's a personal single-user tool behind a password; I run mine behind a
> Cloudflare Tunnel. Feedback welcome — what would you want before trusting it
> with your own notes?
