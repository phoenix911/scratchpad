import type { Env } from "../_lib/types";
import { json } from "../_lib/json";
import { clearCookie } from "../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async () =>
  json({ authed: false }, 200, { "Set-Cookie": clearCookie() });
