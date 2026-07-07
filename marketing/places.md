# Where to share Scratchpad

Links: site <https://phoenix911.github.io/scratchpad/> · repo
<https://github.com/phoenix911/scratchpad>

Golden rules for every venue: **lead with value, not promotion.** Be upfront
that you're the developer, post a real screenshot/GIF, explain what it is in one
line, and reply to every comment for the first few hours (engagement drives
ranking everywhere).

---

## Reddit (best fit first)

| Subreddit | Why it fits | Notes / rules |
|---|---|---|
| [r/selfhosted](https://reddit.com/r/selfhosted) | **The** audience — runs their own apps, owns their data | Self-promo OK if you're transparent; a screenshot + "I built this" works great. Highest-value post. |
| [r/opensource](https://reddit.com/r/opensource) | MIT, code on GitHub | Mention the license + that contributions are welcome. |
| [r/golang](https://reddit.com/r/golang) | Single Go binary, embeds the SPA | Lean into the tech: pure-Go SQLite, `embed.FS`, ~20 MB RAM. Devs love internals. |
| [r/coolgithubprojects](https://reddit.com/r/coolgithubprojects) | Purpose-built for sharing repos | Low friction, just post the repo. |
| [r/SideProject](https://reddit.com/r/SideProject) | Indie builders, supportive | Share the story / why you built it. |
| [r/homelab](https://reddit.com/r/homelab) · [r/HomeServer](https://reddit.com/r/HomeServer) | People with a box to run it on | Frame as "a workspace for your homelab". |
| [r/PKMS](https://reddit.com/r/PKMS) · [r/Zettelkasten](https://reddit.com/r/Zettelkasten) | Notes + backlinks crowd | Emphasize `[[wiki-links]]`, files-on-disk, git. |
| [r/ObsidianMD](https://reddit.com/r/ObsidianMD) · [r/Notion](https://reddit.com/r/Notion) | "self-hosted alternative" angle | Be careful — frame as a complement/alternative, not "X killer". Read pinned self-promo rules first. |
| [r/privacy](https://reddit.com/r/privacy) · [r/degoogle](https://reddit.com/r/degoogle) | Own-your-data, no cloud | Emphasize self-hosted, your git repo, no telemetry. |
| [r/webdev](https://reddit.com/r/webdev) · [r/reactjs](https://reddit.com/r/reactjs) | Built with React/Vite/CodeMirror/Excalidraw | r/reactjs has a "Show /r/reactjs" convention. |

Tip: r/selfhosted, r/golang and r/opensource sometimes have **weekly
"what are you working on / showcase" threads** — posting there sidesteps
self-promo limits.

---

## Link aggregators / launch sites

| Place | Link | Notes |
|---|---|---|
| **Hacker News** | <https://news.ycombinator.com/submit> | Title: `Show HN: Scratchpad – a self-hosted workspace for code, diagrams & notes`. Post morning US-Pacific on a weekday. Be present in comments. |
| **Lobsters** | <https://lobste.rs> | Tag `show`, `go`, `web`. Invite-only to post; quality crowd. |
| **Product Hunt** | <https://www.producthunt.com> | Good for a polished launch day; prepare gallery + tagline. |
| **Indie Hackers** | <https://www.indiehackers.com> | Share the build story. |
| **awesome-selfhosted** | <https://github.com/awesome-selfhosted/awesome-selfhosted> | Open a PR to add it under "Note-taking & Editors" / "Document Management". Big long-tail traffic. |
| **awesome-go** | <https://github.com/avelino/awesome-go> | PR if it fits a category. |
| **selfh.st** | <https://selfh.st/> | Self-hosted newsletter + weekly roundup — submit your project. |
| **AlternativeTo** | <https://alternativeto.net> | List it as an alternative to Notion / Obsidian / Excalidraw. |
| **console.dev** | <https://console.dev/> | Dev-tools newsletter — submit. |
| **LibHunt** | <https://www.libhunt.com> | Auto-indexes GitHub; claim/curate the entry. |

---

## Social / communities

- **Mastodon / Fediverse** — post with `#selfhosted #opensource #golang`; the
  selfhosted fediverse is active and friendly.
- **X/Twitter** — short demo GIF + link; tag #buildinpublic.
- **Discord/Matrix** — the r/selfhosted Discord, Homelab discords.
- **dev.to / Hashnode** — write a short "I built a self-hosted Notion-ish
  workspace in Go + React" post; link the repo. Doubles as SEO.

---

## Before you post (quick checklist)

- [ ] A clean **screenshot or 10-second GIF** (the landing-page shots work).
- [ ] One-line pitch ready (see `launch-posts.md`).
- [ ] README hero + "Editors" + license visible.
- [ ] Releases page has a binary so people can actually try it.
- [ ] Decide if you'll mention there's **no Docker image yet** — the selfhosted
      crowd often asks; a Dockerfile + compose would widen reach a lot.
- [ ] Pace it out: don't blast every subreddit the same day. 1–2 per day, watch
      what lands, iterate the title.
