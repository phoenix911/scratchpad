// Thin typed wrapper over the JSON API. Cookies carry the session, so every
// request is credentialed.

export type ItemType = "code" | "draw" | "mind" | "doc" | "kanban" | "cornell";

export interface Item {
  id: string;
  title: string;
  type: ItemType;
  path: string;
  language: string;
  folder: string;
  createdAt: number;
  updatedAt: number;
}

export interface FullItem extends Item {
  content: string;
}

export interface ShareLink {
  token: string;
  url: string;
  expiresAt: number;
  createdAt?: number;
}

export interface Backlinks {
  backlinks: Item[];
  outgoing: { title: string; item: Item | null }[];
}

export interface Commit {
  hash: string;
  short: string;
  date: number;
  message: string;
}

export interface SyncStatus {
  enabled: boolean;
  state: "off" | "idle" | "syncing" | "conflict" | "error";
  lastSync: number;
  message: string;
}

export interface SharedView {
  type: ItemType;
  title: string;
  language: string;
  content: string;
  expiresAt: number;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.error ?? res.statusText);
  return data as T;
}

export const api = {
  // auth
  me: () => req<{ authed: boolean; app: string }>("GET", "/api/me"),
  login: (password: string) => req<{ authed: boolean }>("POST", "/api/login", { password }),
  logout: () => req<{ authed: boolean }>("POST", "/api/logout"),

  // items
  listItems: () => req<{ items: Item[] }>("GET", "/api/items").then((r) => r.items ?? []),
  getItem: (id: string) => req<FullItem>("GET", `/api/items/${id}`),
  createItem: (input: {
    type: ItemType;
    title: string;
    folder?: string;
    language?: string;
    content?: string;
  }) => req<FullItem>("POST", "/api/items", input),
  updateItem: (
    id: string,
    patch: Partial<Pick<Item, "title" | "folder" | "language">> & { content?: string },
  ) => req<FullItem>("PUT", `/api/items/${id}`, patch),
  deleteItem: (id: string) => req<void>("DELETE", `/api/items/${id}`),

  // sharing
  createShare: (id: string, ttlDays: number) =>
    req<ShareLink>("POST", `/api/items/${id}/share`, { ttlDays }),
  listShares: (id: string) =>
    req<{ shares: ShareLink[] }>("GET", `/api/items/${id}/shares`).then((r) => r.shares ?? []),
  revokeShare: (token: string) => req<void>("DELETE", `/api/shares/${token}`),
  getShared: (token: string) => req<SharedView>("GET", `/api/share/${token}`),

  // history
  history: (id: string) =>
    req<{ commits: Commit[]; syncEnabled: boolean }>("GET", `/api/items/${id}/history`),
  historyVersion: (id: string, hash: string) =>
    req<{ content: string }>("GET", `/api/items/${id}/history/${hash}`).then((r) => r.content),
  restore: (id: string, hash: string) => req<FullItem>("POST", `/api/items/${id}/restore`, { hash }),

  // backlinks
  backlinks: (id: string) => req<Backlinks>("GET", `/api/items/${id}/backlinks`),

  // upload a pasted/dropped image → returns its public URL
  uploadImage: async (file: Blob): Promise<string> => {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!res.ok) throw new ApiError(res.status, "upload failed");
    return (await res.json()).url as string;
  },

  // sync
  syncStatus: () => req<SyncStatus>("GET", "/api/sync/status"),
  sync: () => req<SyncStatus>("POST", "/api/sync"),

  // folders
  listFolders: () => req<{ folders: string[] }>("GET", "/api/folders").then((r) => r.folders ?? []),
  createFolder: (name: string) =>
    req<{ folder: string }>("POST", "/api/folders", { action: "create", name }),
  renameFolder: (name: string, newName: string) =>
    req<{ folder: string }>("POST", "/api/folders", { action: "rename", name, newName }),
  deleteFolder: (name: string) =>
    req<void>("POST", "/api/folders", { action: "delete", name }),
};

export { ApiError };
