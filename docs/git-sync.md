# Git sync

Scratchpad can keep your `DATA_DIR` in sync with a private git repository, so
your notes are backed up, versioned, and portable across machines. Sync shells
out to the system `git` binary, reusing the machine's existing git/SSH config.

Set `GIT_URL` to enable it; leave it blank to run local-only.

## How it works

- On boot: clones the remote into `DATA_DIR` (or initializes a repo + remote),
  then pulls.
- On edit: a debounced commit + push (bursts of edits coalesce into one commit).
- A **Sync now** button in the UI forces an immediate pull + push.
- Commits are authored as `GIT_AUTHOR_NAME <GIT_AUTHOR_EMAIL>`.
- The SQLite index and `.env` live **outside** `DATA_DIR`, so secrets are never
  committed.

## SSH (recommended)

Use an SSH remote and let the machine's SSH key authenticate — no tokens to
store:

```dotenv
GIT_URL=git@github.com:you/scratchpad-data.git
```

On the server, generate a key and add it to the repo as a **deploy key with
write access** (or use an existing key already authorized for the repo):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/scratchpad -N ''
cat ~/.ssh/scratchpad.pub      # add to GitHub repo → Settings → Deploy keys (Allow write)
ssh-keyscan github.com >> ~/.ssh/known_hosts
```

Make sure the user running Scratchpad has access to that key (e.g. via
`~/.ssh/config` or `ssh-agent`).

## HTTPS + token

Alternatively use an HTTPS remote with a fine-grained personal access token
(scoped to the one repo, **Contents: read & write**):

```dotenv
GIT_URL=https://github.com/you/scratchpad-data.git
GIT_USER=you
GIT_PAT=github_pat_xxx
```

## Conflicts

Sync uses fast-forward pulls. If the remote has diverged (e.g. edited from two
machines before syncing), the UI shows a `conflict` state and pauses auto-push;
resolve it in the data repo directly, then sync again.
