import { create } from "zustand";
import { api, type Item, type ItemType } from "@/lib/api";

type Theme = "dark" | "light";
type AuthState = "loading" | "in" | "out";
// Which full-pane view is showing. "item" means an editor is open (activeId).
export type View = "home" | "archive" | "trash" | "item";

interface AppState {
  auth: AuthState;
  appName: string;
  theme: Theme;
  themeManual: boolean; // true once the user toggles; then we stop following the OS
  items: Item[];
  folders: string[];
  activeId: string | null;
  view: View;
  paletteOpen: boolean;
  sidebarCollapsed: boolean;
  reloadNonce: number; // bump to force the open editor to reload its content

  init: () => Promise<void>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (id: string | null) => void;
  setView: (view: Exclude<View, "item">) => void;
  goHome: () => void;
  setPalette: (open: boolean) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  bumpReload: () => void;

  createItem: (type: ItemType, title: string, folder?: string) => Promise<Item>;
  updateMeta: (id: string, patch: Partial<Pick<Item, "title" | "folder" | "language">>) => Promise<void>;
  // archive / recycle-bin transitions
  setItemState: (id: string, state: "active" | "archived" | "trashed") => Promise<void>;
  archiveFolder: (name: string, archived: boolean) => Promise<void>;
  trashFolder: (name: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>; // permanent (recycle bin)
}

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadTheme(): { theme: Theme; manual: boolean } {
  const saved = localStorage.getItem("scratchpad-theme");
  if (saved === "light" || saved === "dark") return { theme: saved, manual: true };
  return { theme: systemTheme(), manual: false };
}

// Restore the last full-pane view. "item" is resolved against activeId in init.
function readView(): View {
  const v = localStorage.getItem("scratchpad-view");
  if (v === "home" || v === "archive" || v === "trash" || v === "item") return v;
  return "home";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
}

const initial = loadTheme();

export const useStore = create<AppState>((set, get) => ({
  auth: "loading",
  appName: "scratchpad",
  theme: initial.theme,
  themeManual: initial.manual,
  items: [],
  folders: [],
  activeId: localStorage.getItem("scratchpad-active"),
  view: readView(),
  paletteOpen: false,
  sidebarCollapsed: localStorage.getItem("scratchpad-sidebar") === "collapsed",
  reloadNonce: 0,

  init: async () => {
    applyTheme(get().theme);
    // Follow the OS theme until the user manually picks one.
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (get().themeManual) return;
      const theme: Theme = e.matches ? "dark" : "light";
      applyTheme(theme);
      set({ theme });
    });

    try {
      const me = await api.me();
      set({ auth: "in", appName: me.app ?? "scratchpad" });
      await get().refresh();
      // Restore the last view. If an item was open, reopen it when it still
      // exists and is active (not archived/trashed); otherwise land on home.
      const { items, activeId, view } = get();
      const open = activeId && items.find((i) => i.id === activeId);
      if (view === "item" && (!open || open.archived || open.trashed)) get().goHome();
    } catch {
      set({ auth: "out" });
    }
  },

  login: async (password) => {
    await api.login(password);
    set({ auth: "in" });
    await get().refresh();
  },

  logout: async () => {
    await api.logout();
    set({ auth: "out", items: [], folders: [], activeId: null });
  },

  refresh: async () => {
    const [items, folders] = await Promise.all([api.listItems(), api.listFolders()]);
    set({ items, folders });
  },

  setActive: (id) => {
    if (id) localStorage.setItem("scratchpad-active", id);
    else localStorage.removeItem("scratchpad-active");
    localStorage.setItem("scratchpad-view", id ? "item" : "home");
    set({ activeId: id, view: id ? "item" : "home" });
  },
  setView: (view) => {
    localStorage.setItem("scratchpad-view", view);
    set({ view });
  },
  goHome: () => get().setView("home"),
  setPalette: (open) => set({ paletteOpen: open }),
  bumpReload: () => set((s) => ({ reloadNonce: s.reloadNonce + 1 })),

  toggleTheme: () => {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    localStorage.setItem("scratchpad-theme", theme);
    set({ theme, themeManual: true });
  },

  toggleSidebar: () => {
    const collapsed = !get().sidebarCollapsed;
    localStorage.setItem("scratchpad-sidebar", collapsed ? "collapsed" : "open");
    set({ sidebarCollapsed: collapsed });
  },

  createItem: async (type, title, folder) => {
    const it = await api.createItem({ type, title, folder, content: "" });
    await get().refresh();
    get().setActive(it.id);
    return it;
  },

  updateMeta: async (id, patch) => {
    await api.updateItem(id, patch);
    await get().refresh();
  },

  setItemState: async (id, state) => {
    const wasOpen = get().activeId === id && get().view === "item";
    await api.setItemState(id, state);
    await get().refresh();
    if (state === "active") {
      get().setActive(id); // open the restored item
    } else if (wasOpen) {
      get().goHome(); // the open item left the active tree
    }
  },

  archiveFolder: async (name, archived) => {
    await api.archiveFolder(name, archived);
    await get().refresh();
  },

  trashFolder: async (name) => {
    await api.trashFolder(name);
    await get().refresh();
  },

  deleteItem: async (id) => {
    await api.deleteItem(id);
    const { activeId } = get();
    await get().refresh();
    // Permanently deleting the open file drops back to the home view.
    if (activeId === id) get().goHome();
  },
}));
