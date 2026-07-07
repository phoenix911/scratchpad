import type { Env } from "../_lib/types";
import { getUpload } from "../_lib/r2";

// PUBLIC: serve an uploaded image from R2 (shared docs embed these). Single path
// segment only; no traversal.
export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const name = String(params.name);
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return new Response("not found", { status: 404 });
  }
  const obj = await getUpload(env, name);
  if (!obj) return new Response("not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("etag", obj.httpEtag);
  return new Response(obj.body, { headers });
};
