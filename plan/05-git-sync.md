# Scratchpad — Git Sync

The `data/` directory is a git working tree whose remote is a private GitHub
repo (`scratchpad-data.git`). Sync is handled in-process by **go-git** (pure Go)
— no system `git` binary required, which keeps the NAS deploy a single static file.

## Auth: SSH (decided)
The deploy machine (NAS) has an SSH key with access to the private data repo, so
sync authenticates over **SSH** — no PAT to store or rotate.

- `GIT_URL=git@github.com:phoenix911/scratchpad-data.git` (SSH form).
- go-git uses the SSH transport with auth resolved from, in order:
  1. the `ssh-agent` (if `SSH_AUTH_SOCK` is set), else
  2. the default key (`~/.ssh/id_ed25519` / `id_rsa`), optional `GIT_SSH_KEY` path.
- HTTPS + `GIT_PAT` remains supported as a fallback if `GIT_URL` is an https URL.

`config.GitIsSSH()` selects the transport. Known-hosts: accept GitHub's host key
on first use (documented in README) or ship a pinned `known_hosts`.

## Flow
- **Boot:** `EnsureRepo` — if `data/.git` missing, clone the repo (or `init` +
  add remote if the repo is empty). Then `Pull` (fast-forward).
- **Save:** writing/deleting an item schedules a **debounced** (5s, coalesced)
  `CommitAndPush`. Many rapid edits → one commit.
- **Manual:** `POST /api/sync` does pull-then-push on demand.
- **Commit messages:** auto, e.g. `update <title>`, `add <title>`,
  `delete <title>`.

## go-git operations
| Func | Does |
|---|---|
| `EnsureRepo()` | clone or init+remote; ensure `.gitignore` excludes `app.db`/`config.json` |
| `Pull()` | fetch + fast-forward merge; report if non-FF (conflict) |
| `CommitAndPush(msg)` | `worktree.Add(.)`, commit (author = "Slate"), push with PAT auth |

## Conflict handling
Single user, so conflicts are rare (e.g. edited on two machines before syncing).
- On non-fast-forward pull, **do not** auto-merge destructively.
- Surface a `conflict` state in `SyncStatus`; offer "keep mine / take remote" at
  the item level in the UI (a later refinement — initial version just flags it
  and pauses auto-push until resolved).

## What is NOT synced
- `app.db` (rebuildable index) and `.env` (secrets) — both kept outside
  `data/` and listed in `.gitignore` as belt-and-suspenders.
- `shares` live only in `app.db`; share links are intentionally local to the
  running instance and not part of the git history.
