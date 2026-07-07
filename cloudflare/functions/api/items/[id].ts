import type { Env } from "../../_lib/types";
import { json, err, noContent, readJSON } from "../../_lib/json";
import * as items from "../../_lib/items";

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const fi = await items.get(env, String(params.id));
  return fi ? json(fi) : err(404, "not found");
};

export const onRequestPut: PagesFunction<Env> = async ({ params, request, env }) => {
  const patch = await readJSON<items.UpdateInput>(request);
  const fi = await items.update(env, String(params.id), patch);
  return fi ? json(fi) : err(404, "not found");
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const ok = await items.purge(env, String(params.id));
  return ok ? noContent() : err(404, "not found");
};
