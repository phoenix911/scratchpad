import type { Env } from "../_lib/types";
import * as db from "../_lib/d1";
import * as items from "../_lib/items";

// PUBLIC 1200×630 share-preview card. The Go app rasterizes a PNG in-process;
// at the edge we serve a dependency-free SVG card (no font/wasm bundling).
const TYPE_LABEL: Record<string, string> = {
  code: "code snippet",
  draw: "drawing",
  mind: "mindmap",
  doc: "doc",
  kanban: "board",
  cornell: "Cornell note",
  sticky: "sticky board",
  wf: "outline",
};

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const token = String(params.token).replace(/\.png$/, "");
  const app = env.APP_NAME ?? "Scratchpad";
  let title = app;
  let caption = "A self-hosted workspace";
  const sh = await db.getShare(env, token);
  if (sh && !(sh.expiresAt !== 0 && Math.floor(Date.now() / 1000) >= sh.expiresAt)) {
    const it = await db.getItem(env, sh.itemId);
    if (it) {
      title = it.title || "Untitled";
      caption = `Shared ${TYPE_LABEL[it.type] ?? it.type}`;
    }
  }
  const t = title.length > 60 ? title.slice(0, 59) + "…" : title;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0f1115"/>
  <rect x="0" y="0" width="1200" height="12" fill="#ae3ec9"/>
  <text x="80" y="150" font-family="ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif" font-size="26" fill="#8a8f98" letter-spacing="2">${esc(app.toUpperCase())}</text>
  <text x="80" y="330" font-family="ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif" font-size="84" font-weight="700" fill="#f3f4f6">${esc(t)}</text>
  <text x="80" y="420" font-family="ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34" fill="#9aa1ab">${esc(caption)}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
