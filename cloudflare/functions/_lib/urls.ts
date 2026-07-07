import type { Env } from "./types";

// Absolute share link from SHARE_BASE_URL, or a relative path if unset (port of
// share_handlers.go shareURL).
export function shareURL(env: Env, token: string): string {
  let base = env.SHARE_BASE_URL ?? "";
  if (!base) return "/s/" + token;
  if (!base.startsWith("http://") && !base.startsWith("https://")) base = "https://" + base;
  return base.replace(/\/+$/, "") + "/s/" + token;
}
