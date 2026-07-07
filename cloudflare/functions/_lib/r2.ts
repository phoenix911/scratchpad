// R2 blob layer. Item content lives at content/<id>; uploaded images at
// uploads/<name>. R2 replaces the Go app's on-disk DATA_DIR.
import type { Env } from "./types";

const CONTENT_TYPE = "text/plain; charset=utf-8";

export async function putContent(env: Env, id: string, content: string): Promise<void> {
  await env.BUCKET.put(`content/${id}`, content, { httpMetadata: { contentType: CONTENT_TYPE } });
}

export async function getContent(env: Env, id: string): Promise<string> {
  const obj = await env.BUCKET.get(`content/${id}`);
  return obj ? await obj.text() : "";
}

export async function deleteContent(env: Env, id: string): Promise<void> {
  await env.BUCKET.delete(`content/${id}`);
}

export async function putUpload(env: Env, name: string, body: ArrayBuffer, contentType: string): Promise<void> {
  await env.BUCKET.put(`uploads/${name}`, body, { httpMetadata: { contentType } });
}

export async function getUpload(env: Env, name: string): Promise<R2ObjectBody | null> {
  return env.BUCKET.get(`uploads/${name}`);
}
