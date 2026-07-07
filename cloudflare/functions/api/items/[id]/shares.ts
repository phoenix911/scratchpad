import type { Env } from "../../../_lib/types";
import { json } from "../../../_lib/json";
import * as db from "../../../_lib/d1";
import { shareURL } from "../../../_lib/urls";

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  await db.deleteExpiredShares(env, Math.floor(Date.now() / 1000));
  const shares = await db.sharesForItem(env, String(params.id));
  return json({
    shares: shares.map((sh) => ({ token: sh.token, url: shareURL(env, sh.token), expiresAt: sh.expiresAt, createdAt: sh.createdAt })),
  });
};
