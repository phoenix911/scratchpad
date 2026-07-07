import type { Env } from "../_lib/types";
import { json, err } from "../_lib/json";
import { isAuthed } from "../_lib/auth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return err(401, "unauthorized");
  return json({ authed: true, app: env.APP_NAME ?? "Scratchpad" });
};
