# Scratchpad — Git Sync

The `data/` directory is a git working tree whose remote is a private GitHub
repo (`scratchpad-data.git`). Sync shells out to the **system `git` binary**
(`os/exec`), so it reuses the machine's existing git/SSH config — agent, keys,
`known_hosts`, `~/.gitconfig` — and behaves exactly like git on the command line.
Requires `git` installed on the deploy box (accepted). No go-git dependency.

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

## Syncer operations (`internal/git`, system git)
| Func | Does |
|---|---|
| `EnsureRepo()` | clone into an empty data dir (also handles an empty remote), else `git init -b main` + `git remote add origin`; sets a local commit identity |
| `Pull()` | `git fetch` + `git merge --ff-only origin/<branch>`; missing/empty upstream ignored; divergence → `conflict` state |
| `Schedule()` | debounced (5s, coalesced) commit+push after edits |
| `SyncNow()` | immediate pull + commit + push (the "Sync now" button) |
| `commitAndPush()` | `git add -A`; commit only if dirty; `git push -u origin HEAD` |

Each `git` call runs with `GIT_TERMINAL_PROMPT=0` and a 60s timeout so a hung
network op can't block or hang on a credential prompt.

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
