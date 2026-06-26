import { create } from "zustand";
import { api, type Item, type ItemType } from "./lib/api";

type Theme = "dark" | "light";
type AuthState = "loading" | "in" | "out";

interface AppState {
  auth: AuthState;
  appName: string;
  theme: Theme;
  themeManual: boolean; // true once the user toggles; then we stop following the OS
  items: Item[];
  folders: string[];
  activeId: string | null;
  paletteOpen: boolean;
  sidebarCollapsed: boolean;
  reloadNonce: number; // bump to force the open editor to reload its content

  init: () => Promise<void>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (id: string | null) => void;
  setPalette: (open: boolean) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  bumpReload: () => void;

  createItem: (type: ItemType, title: string, folder?: string) => Promise<Item>;
  updateMeta: (id: string, patch: Partial<Pick<Item, "title" | "folder" | "language">>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadTheme(): { theme: Theme; manual: boolean } {
  const saved = localStorage.getItem("scratchpad-theme");
  if (saved === "light" || saved === "dark") return { theme: saved, manual: true };
  return { theme: systemTheme(), manual: false };
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
  activeId: null,
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
      const { items, activeId } = get();
      if (!activeId && items.length > 0) set({ activeId: items[0].id });
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

  setActive: (id) => set({ activeId: id }),
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
    set({ activeId: it.id });
    return it;
  },

  updateMeta: async (id, patch) => {
    await api.updateItem(id, patch);
    await get().refresh();
  },

  deleteItem: async (id) => {
    await api.deleteItem(id);
    const { activeId } = get();
    await get().refresh();
    if (activeId === id) set({ activeId: null });
  },
}));
