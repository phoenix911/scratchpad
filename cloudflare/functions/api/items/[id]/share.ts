import type { Env, Share } from "../../../_lib/types";
import { json, err, readJSON } from "../../../_lib/json";
import * as db from "../../../_lib/d1";
import * as items from "../../../_lib/items";
import { newShareToken } from "../../../_lib/ids";
import { shareURL } from "../../../_lib/urls";

const MIN_DAYS = 1;
const MAX_DAYS = 30;

// Mint a view-only token. ttlDays <= 0 (or absent) = never; else clamped [1,30].
export const onRequestPost: PagesFunction<Env> = async ({ params, request, env }) => {
  const id = String(params.id);
  if (!(await items.get(env, id))) return err(404, "not found");

  const { ttlDays } = await readJSON<{ ttlDays?: number }>(request);
  const nowSec = Math.floor(Date.now() / 1000);
  let expiresAt = 0;
  if (ttlDays && ttlDays > 0) {
    const days = Math.min(Math.max(ttlDays, MIN_DAYS), MAX_DAYS);
    expiresAt = nowSec + days * 24 * 60 * 60;
  }
  const sh: Share = { token: newShareToken(), itemId: id, expiresAt, createdAt: nowSec };
  await db.createShare(env, sh);
  return json({ token: sh.token, url: shareURL(env, sh.token), expiresAt: sh.expiresAt }, 201);
};
