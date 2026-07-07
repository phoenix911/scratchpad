import type { Env } from "../../../_lib/types";
import { json, err } from "../../../_lib/json";
import * as db from "../../../_lib/d1";

// { backlinks: items linking here, outgoing: [{title, item|null}] } — mirrors
// handleBacklinks.
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const id = String(params.id);
  const it = await db.getItem(env, id);
  if (!it) return err(404, "not found");
  const backlinks = await db.backlinkItems(env, it.title, id);
  const titles = await db.linkTitles(env, id);
  const outgoing = await Promise.all(titles.map(async (t) => ({ title: t, item: await db.itemByTitle(env, t) })));
  return json({ backlinks, outgoing });
};
