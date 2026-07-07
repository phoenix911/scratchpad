import type { Env } from "../_lib/types";
import { json, err, readJSON } from "../_lib/json";
import { passwordOK, sessionCookie } from "../_lib/auth";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { password } = await readJSON<{ password?: string }>(request);
  if (!passwordOK(env, password ?? "")) return err(401, "wrong password");
  return json({ authed: true }, 200, { "Set-Cookie": await sessionCookie(env, request) });
};
