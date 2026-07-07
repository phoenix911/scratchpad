// Item service — the domain logic over D1 (metadata) + R2 (content). Port of
// internal/items/items.go, adapted so D1 is authoritative and content is an R2
// blob keyed by id (moves/renames touch only D1).
import type { Env, Item } from "./types";
import * as db from "./d1";
import * as r2 from "./r2";
import { newID, slug, cleanFolder } from "./ids";
import { extractLinks } from "./links";

export const TYPES = ["code", "draw", "mind", "doc", "kanban", "cornell", "sticky", "wf"] as const;
export type ItemType = (typeof TYPES)[number];

export function validType(t: string): t is ItemType {
  return (TYPES as readonly string[]).includes(t);
}

// Extension per type (cosmetic — used for the logical `path` shown in the UI).
const EXT: Record<string, string> = {
  draw: "excalidraw",
  mind: "mind",
  doc: "doc",
  kanban: "kanban",
  cornell: "cornell",
  sticky: "sticky",
  wf: "wf",
};

function relPath(it: Item): string {
  const ext = it.type === "code" ? it.language || "txt" : EXT[it.type] || "txt";
  const name = `${slug(it.title)}-${it.id}.${ext}`;
  const root = it.trashed ? "trash" : it.archived ? "archive" : "items";
  return it.folder ? `${root}/${it.folder}/${name}` : `${root}/${name}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export interface FullItem extends Item {
  content: string;
}

export interface CreateInput {
  type: string;
  title?: string;
  folder?: string;
  language?: string;
  content?: string;
}

export async function create(env: Env, input: CreateInput): Promise<FullItem> {
  if (!validType(input.type)) throw new HttpError(400, `invalid type ${input.type}`);
  const t = now();
  const title = (input.title ?? "").trim() || "untitled";
  const it: Item = {
    id: newID(),
    title,
    type: input.type,
    path: "",
    language: input.type === "code" ? (input.language ?? "").trim().toLowerCase() || "text" : "",
    folder: cleanFolder(input.folder ?? ""),
    archived: false,
    trashed: false,
    createdAt: t,
    updatedAt: t,
  };
  it.path = relPath(it);
  const content = input.content ?? "";
  await r2.putContent(env, it.id, content);
  await db.upsertItem(env, it);
  await db.setLinks(env, it.id, extractLinks(content));
  return { ...it, content };
}

export async function get(env: Env, id: string): Promise<FullItem | null> {
  const it = await db.getItem(env, id);
  if (!it) return null;
  return { ...it, content: await r2.getContent(env, id) };
}

export interface UpdateInput {
  title?: string;
  folder?: string;
  language?: string;
  content?: string;
}

export async function update(env: Env, id: string, patch: UpdateInput): Promise<FullItem | null> {
  const it = await db.getItem(env, id);
  if (!it) return null;
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (t) it.title = t;
  }
  if (patch.folder !== undefined) it.folder = cleanFolder(patch.folder);
  if (patch.language !== undefined && it.type === "code") {
    const l = patch.language.trim().toLowerCase();
    if (l) it.language = l;
  }
  it.updatedAt = now();
  it.path = relPath(it);
  let content = patch.content;
  if (content !== undefined) {
    await r2.putContent(env, id, content);
    await db.setLinks(env, id, extractLinks(content));
  } else {
    content = await r2.getContent(env, id);
  }
  await db.upsertItem(env, it);
  return { ...it, content: content ?? "" };
}

// Move between active / archived / trashed states (D1 flags + path only).
export async function setState(env: Env, id: string, archived: boolean, trashed: boolean): Promise<Item | null> {
  const it = await db.getItem(env, id);
  if (!it) return null;
  if (it.archived === archived && it.trashed === trashed) return it;
  it.archived = archived;
  it.trashed = trashed;
  it.path = relPath(it);
  await db.upsertItem(env, it);
  return it;
}

// Permanently remove (from the recycle bin).
export async function purge(env: Env, id: string): Promise<boolean> {
  const it = await db.getItem(env, id);
  if (!it) return false;
  await r2.deleteContent(env, id);
  await db.deleteItemRow(env, id);
  return true;
}

// --- folder ops (operate on items by folder prefix) ---
function inFolder(it: Item, folder: string): boolean {
  return it.folder === folder || it.folder.startsWith(folder + "/");
}

export async function archiveFolder(env: Env, folder: string, archived: boolean): Promise<number> {
  const clean = cleanFolder(folder);
  if (!clean) return 0;
  const items = await db.listItems(env);
  let n = 0;
  for (const it of items) {
    if (it.trashed || it.archived === archived || !inFolder(it, clean)) continue;
    await setState(env, it.id, archived, false);
    n++;
  }
  return n;
}

export async function trashFolder(env: Env, folder: string): Promise<number> {
  const clean = cleanFolder(folder);
  if (!clean) return 0;
  const items = await db.listItems(env);
  let n = 0;
  for (const it of items) {
    if (it.trashed || !inFolder(it, clean)) continue;
    await setState(env, it.id, false, true);
    n++;
  }
  return n;
}

export async function renameFolder(env: Env, from: string, to: string): Promise<string> {
  const a = cleanFolder(from);
  const b = cleanFolder(to);
  if (!a || !b) throw new HttpError(400, "invalid folder name");
  const items = await db.listItems(env);
  for (const it of items) {
    if (!inFolder(it, a)) continue;
    it.folder = it.folder === a ? b : b + it.folder.slice(a.length);
    it.updatedAt = now();
    it.path = relPath(it);
    await db.upsertItem(env, it);
  }
  return b;
}

// A small typed error so handlers can map to a status code.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
