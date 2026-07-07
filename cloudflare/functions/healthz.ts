import type { Env } from "./_lib/types";
import { json } from "./_lib/json";

export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({ ok: true, app: env.APP_NAME ?? "Scratchpad", syncEnabled: false });
