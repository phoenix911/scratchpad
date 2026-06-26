import { create } from "zustand";
import { api, type Item, type ItemType } from "./lib/api";

type Theme = "dark" | "light";
type AuthState = "loading" | "in" | "out";

interface AppState {
  auth: AuthState;
  appName: string;
  theme: Theme;
  items: Item[];
  folders: string[];
  activeId: string | null;
  paletteOpen: boolean;

  init: () => Promise<void>;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setActive: (id: string | null) => void;
  setPalette: (open: boolean) => void;
  toggleTheme: () => void;

  createItem: (type: ItemType, title: string, folder?: string) => Promise<Item>;
  deleteItem: (id: string) => Promise<void>;
}

function loadTheme(): Theme {
  // Default to dark — it's a code tool, and the graphite drafting surface is the
  // primary identity. Honor an explicit saved choice either way.
  const saved = localStorage.getItem("scratchpad-theme");
  return saved === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("scratchpad-theme", theme);
}

export const useStore = create<AppState>((set, get) => ({
  auth: "loading",
  appName: "Scratchpad",
  theme: loadTheme(),
  items: [],
  folders: [],
  activeId: null,
  paletteOpen: false,

  init: async () => {
    applyTheme(get().theme);
    try {
      const me = await api.me();
      set({ auth: "in", appName: me.app ?? "Scratchpad" });
      await get().refresh();
      // Open the most recently edited item on first load.
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

  toggleTheme: () => {
    const theme: Theme = get().theme === "dark" ? "light" : "dark";
    applyTheme(theme);
    set({ theme });
  },

  createItem: async (type, title, folder) => {
    const it = await api.createItem({ type, title, folder, content: type === "draw" ? "" : "" });
    await get().refresh();
    set({ activeId: it.id });
    return it;
  },

  deleteItem: async (id) => {
    await api.deleteItem(id);
    const { activeId } = get();
    await get().refresh();
    if (activeId === id) set({ activeId: null });
  },
}));
