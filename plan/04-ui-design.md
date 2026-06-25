# Slate — UI Design

Goal: it should look like Apple made it. Deliberate, calm, distinctive — not a
default-looking dashboard. I'll use the `frontend-design` skill while building.

## Design language
- **Canvas:** deep, near-black neutral (`#0B0B0F`) with one warm accent. A clean
  **light theme** as a true peer, not an afterthought. Respect
  `prefers-color-scheme`, with a manual toggle.
- **Glass, sparingly:** subtle translucency + `backdrop-blur` on the sidebar and
  the command bar — the "Apple glass" cue, used in 1–2 places, never everywhere.
- **Type & space:** a real type scale, generous spacing, tabular/mono for code.
- **Motion:** spring physics on panel transitions; quiet and tasteful, no
  bounce-fest. Reduced-motion respected.
- **Signature interaction:** a **⌘K command palette** as primary nav.

## Screens / components
- **AppShell** — translucent left sidebar (folder tree + search) | content area;
  top-right: sync status + theme toggle. ⌘K overlays everything.
- **CommandPalette (⌘K)** — new snippet, new drawing, jump to item (fuzzy),
  share current, sync now, toggle theme.
- **CodeEditor** — CodeMirror 6, custom theme; language pill w/ switcher;
  autosave indicator; copy button; soft-wrap toggle.
- **DrawCanvas** — Excalidraw, lazy-loaded; autosaves scene JSON; themed to the
  shell (matching dark/light) so it doesn't look bolted on.
- **ShareDialog** — TTL slider (1 → 30 days, default 1), generated link with copy
  button + human expiry ("expires in 1 day"), list + revoke existing shares.
  Available for **both** code snippets and drawings.
- **ShareView** (public) — minimal branded page, no app chrome.
  - code → CodeMirror read-only.
  - draw → Excalidraw `viewModeEnabled`.
- **Sidebar/FolderTree** — drag to reorganize, inline rename, new-folder action.
- **SyncStatus** — idle / syncing / conflict / error pill with last-sync time.

## Footprint discipline (UI side)
- Excalidraw is **route-split**: opening a code snippet never loads its bundle.
- CodeMirror language modes loaded on demand.
- Debounced autosave; no chatty polling (sync status via lightweight calls).

## Empty / first-run states
- Config (password, PAT, repo URL, port) comes from the **`.env`** file, so there
  is no in-app setup wizard — first run just shows the login screen.
- Login screen: a single password field, on-brand and minimal.
- Empty workspace: a single elegant "Create your first snippet / drawing" prompt
  wired to ⌘K.
- If `GIT_URL`/`GIT_PAT` are unset, the SyncStatus pill shows "sync off"
  (local-only mode) rather than erroring.
