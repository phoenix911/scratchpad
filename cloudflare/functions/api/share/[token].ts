import type { Env } from "../../_lib/types";
import { json, err } from "../../_lib/json";
import * as db from "../../_lib/d1";
import * as items from "../../_lib/items";

// PUBLIC read-only view of a shared item. 404 unknown/revoked, 410 expired.
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const token = String(params.token);
  const sh = await db.getShare(env, token);
  if (!sh) return err(404, "not found");
  if (sh.expiresAt !== 0 && Math.floor(Date.now() / 1000) >= sh.expiresAt) {
    await db.deleteShare(env, token);
    return err(410, "this link has expired");
  }
  const fi = await items.get(env, sh.itemId);
  if (!fi) return err(404, "not found");
  return json({ type: fi.type, title: fi.title, language: fi.language, content: fi.content, expiresAt: sh.expiresAt });
};
