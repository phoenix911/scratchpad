# Scratchpad docs

A self-hosted, single-binary workspace for **code, drawings, mindmaps, docs and
kanban boards** — everything stored as plain files, synced to your own private
git repo, and shareable with expiring view-only links.

![Scratchpad](assets/code.png)

## Start here

<div class="grid cards" markdown>

- **[Getting started](getting-started.md)** — run it locally in two minutes.
- **[Configuration](configuration.md)** — every environment variable.
- **[Deployment](deployment.md)** — systemd + any reverse proxy or tunnel.
- **[Git sync](git-sync.md)** — back your data up to a private repo.
- **[Item types](item-types.md)** — the five editors and how they're stored.
- **[Architecture](architecture.md)** · **[Data model](data-model.md)** · **[HTTP API](api.md)**

</div>

## Quick start

```bash
git clone https://github.com/phoenix911/scratchpad
cd scratchpad
make all          # build the SPA, embed it, produce ./scratchpad
./scratchpad      # http://localhost:8080
```

See **[Getting started](getting-started.md)** for the rest, and the
[landing page](https://phoenix911.github.io/scratchpad/) for an overview.
