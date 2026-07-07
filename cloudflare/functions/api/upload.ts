import type { Env } from "../_lib/types";
import { json, err } from "../_lib/json";
import { newShareToken } from "../_lib/ids";
import { putUpload } from "../_lib/r2";

const MAX_BYTES = 10 << 20; // 10 MB
const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

// Store a pasted/dropped image in R2 (uploads/<token>.<ext>) and return its URL.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ct = (request.headers.get("Content-Type") ?? "").split(";")[0].trim();
  const ext = IMAGE_EXT[ct];
  if (!ext) return err(415, "only images are supported");
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return err(400, "image too large");
  const name = `${newShareToken()}.${ext}`;
  await putUpload(env, name, body, ct);
  return json({ url: `/uploads/${name}` }, 201);
};
