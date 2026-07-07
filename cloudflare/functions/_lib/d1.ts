// D1 access layer — the index (items, shares, links, settings). Ports
// internal/store/*.go. Rows are snake_case in SQL, camelCase in the API shape.
import type { Env, Item, Share } from "./types";

interface ItemRow {
  id: string;
  title: string;
  type: string;
  path: string;
  language: string;
  folder: string;
  archived: number;
  trashed: number;
  created_at: number;
  updated_at: number;
}

function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    path: r.path,
    language: r.language,
    folder: r.folder,
    archived: !!r.archived,
    trashed: !!r.trashed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const ITEM_COLS = "id, title, type, path, language, folder, archived, trashed, created_at, updated_at";

export async function listItems(env: Env): Promise<Item[]> {
  const { results } = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items ORDER BY updated_at DESC`).all<ItemRow>();
  return (results ?? []).map(toItem);
}

export async function getItem(env: Env, id: string): Promise<Item | null> {
  const r = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE id = ?`).bind(id).first<ItemRow>();
  return r ? toItem(r) : null;
}

export async function upsertItem(env: Env, it: Item): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO items (id, title, type, path, language, folder, archived, trashed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, type=excluded.type, path=excluded.path,
       language=excluded.language, folder=excluded.folder, archived=excluded.archived,
       trashed=excluded.trashed, updated_at=excluded.updated_at`,
  )
    .bind(it.id, it.title, it.type, it.path, it.language, it.folder, it.archived ? 1 : 0, it.trashed ? 1 : 0, it.createdAt, it.updatedAt)
    .run();
}

export async function deleteItemRow(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(id).run();
}

export async function setLinks(env: Env, fromId: string, titles: string[]): Promise<void> {
  const stmts: D1PreparedStatement[] = [env.DB.prepare(`DELETE FROM links WHERE from_id = ?`).bind(fromId)];
  for (const t of titles) {
    if (t) stmts.push(env.DB.prepare(`INSERT INTO links (from_id, to_title) VALUES (?, ?)`).bind(fromId, t));
  }
  await env.DB.batch(stmts);
}

export async function backlinkItems(env: Env, title: string, selfId: string): Promise<Item[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT i.id, i.title, i.type, i.path, i.language, i.folder, i.archived, i.trashed, i.created_at, i.updated_at
     FROM items i JOIN links l ON l.from_id = i.id
     WHERE lower(l.to_title) = lower(?) AND i.id != ? AND i.trashed = 0
     ORDER BY i.updated_at DESC`,
  )
    .bind(title, selfId)
    .all<ItemRow>();
  return (results ?? []).map(toItem);
}

export async function linkTitles(env: Env, fromId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(`SELECT to_title FROM links WHERE from_id = ?`).bind(fromId).all<{ to_title: string }>();
  return (results ?? []).map((r) => r.to_title);
}

export async function itemByTitle(env: Env, title: string): Promise<Item | null> {
  const r = await env.DB.prepare(`SELECT ${ITEM_COLS} FROM items WHERE lower(title) = lower(?) AND trashed = 0 LIMIT 1`).bind(title).first<ItemRow>();
  return r ? toItem(r) : null;
}

// Distinct folders that hold at least one active item.
export async function activeFolders(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT folder FROM items WHERE folder != '' AND archived = 0 AND trashed = 0 ORDER BY folder`,
  ).all<{ folder: string }>();
  return (results ?? []).map((r) => r.folder);
}

// --- shares ---
export async function createShare(env: Env, sh: Share): Promise<void> {
  await env.DB.prepare(`INSERT INTO shares (token, item_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .bind(sh.token, sh.itemId, sh.expiresAt, sh.createdAt)
    .run();
}

export async function getShare(env: Env, token: string): Promise<Share | null> {
  const r = await env.DB.prepare(`SELECT token, item_id, expires_at, created_at FROM shares WHERE token = ?`).bind(token).first<{
    token: string;
    item_id: string;
    expires_at: number;
    created_at: number;
  }>();
  return r ? { token: r.token, itemId: r.item_id, expiresAt: r.expires_at, createdAt: r.created_at } : null;
}

export async function sharesForItem(env: Env, itemId: string): Promise<Share[]> {
  const { results } = await env.DB.prepare(
    `SELECT token, item_id, expires_at, created_at FROM shares WHERE item_id = ? ORDER BY created_at DESC`,
  )
    .bind(itemId)
    .all<{ token: string; item_id: string; expires_at: number; created_at: number }>();
  return (results ?? []).map((r) => ({ token: r.token, itemId: r.item_id, expiresAt: r.expires_at, createdAt: r.created_at }));
}

export async function deleteShare(env: Env, token: string): Promise<boolean> {
  const res = await env.DB.prepare(`DELETE FROM shares WHERE token = ?`).bind(token).run();
  return (res.meta.changes ?? 0) > 0;
}

export async function deleteExpiredShares(env: Env, now: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM shares WHERE expires_at != 0 AND expires_at < ?`).bind(now).run();
}
