import type { Env } from "../../../_lib/types";
import { err, noContent, readJSON } from "../../../_lib/json";
import * as items from "../../../_lib/items";

// Move an item between active / archived / trashed (mirrors handleSetItemState).
export const onRequestPost: PagesFunction<Env> = async ({ params, request, env }) => {
  const { state } = await readJSON<{ state?: string }>(request);
  const id = String(params.id);
  let res: unknown;
  if (state === "active") res = await items.setState(env, id, false, false);
  else if (state === "archived") res = await items.setState(env, id, true, false);
  else if (state === "trashed") res = await items.setState(env, id, false, true);
  else return err(400, "unknown state");
  return res ? noContent() : err(404, "not found");
};
