import type { Env } from "../_lib/types";
import * as db from "../_lib/d1";

// PUBLIC share page: serve the SPA shell (which fetches /api/share/:token to
// render) with Open Graph / Twitter meta injected for link unfurls. Mirrors
// internal/httpapi/share_page.go.
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

export const onRequestGet: PagesFunction<Env> = async ({ request, params, env }) => {
  const token = String(params.token);
  const app = env.APP_NAME ?? "Scratchpad";
  let title = app;
  let caption = "A self-hosted workspace for code, drawings, docs & boards";

  const sh = await db.getShare(env, token);
  if (sh && !(sh.expiresAt !== 0 && Math.floor(Date.now() / 1000) >= sh.expiresAt)) {
    const it = await db.getItem(env, sh.itemId);
    if (it) {
      title = it.title || "Untitled";
      caption = `Shared ${TYPE_LABEL[it.type] ?? it.type}`;
    }
  }

  const origin = new URL(request.url).origin;
  const ogImage = `${origin}/og/${token}.png`;
  const pageURL = request.url;
  const heading = `${title} · scratchpad`;

  const tags =
    `<meta property="og:type" content="website">` +
    `<meta property="og:title" content="${esc(heading)}">` +
    `<meta property="og:description" content="${esc(caption)}">` +
    `<meta property="og:image" content="${esc(ogImage)}">` +
    `<meta property="og:image:width" content="1200">` +
    `<meta property="og:image:height" content="630">` +
    `<meta property="og:url" content="${esc(pageURL)}">` +
    `<meta name="twitter:card" content="summary_large_image">` +
    `<meta name="twitter:title" content="${esc(heading)}">` +
    `<meta name="twitter:description" content="${esc(caption)}">` +
    `<meta name="twitter:image" content="${esc(ogImage)}">`;

  const shell = await env.ASSETS.fetch(new URL("/index.html", request.url));
  let html = await shell.text();
  html = html.includes("</head>") ? html.replace("</head>", tags + "</head>") : tags + html;

  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
};
