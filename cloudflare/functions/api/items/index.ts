import type { Env } from "../../_lib/types";
import { json, err, readJSON } from "../../_lib/json";
import * as db from "../../_lib/d1";
import * as items from "../../_lib/items";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => json({ items: await db.listItems(env) });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJSON<items.CreateInput>(request);
  try {
    return json(await items.create(env, body), 201);
  } catch (e) {
    if (e instanceof items.HttpError) return err(e.status, e.message);
    throw e;
  }
};
