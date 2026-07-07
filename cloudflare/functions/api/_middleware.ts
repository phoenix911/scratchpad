// Auth gate for /api/*. Login/logout/me handle their own auth; the public share
// read endpoint is open. Everything else requires a valid session.
import type { Env } from "../_lib/types";
import { isAuthed } from "../_lib/auth";
import { err } from "../_lib/json";

const OPEN = new Set(["/api/login", "/api/logout", "/api/me"]);

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const path = new URL(ctx.request.url).pathname;
  const open = OPEN.has(path) || path.startsWith("/api/share/");
  if (!open && !(await isAuthed(ctx.request, ctx.env))) return err(401, "unauthorized");
  return ctx.next();
};
