import type { Env } from "../../_lib/types";
import { err, noContent } from "../../_lib/json";
import * as db from "../../_lib/d1";

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  const ok = await db.deleteShare(env, String(params.token));
  return ok ? noContent() : err(404, "not found");
};
