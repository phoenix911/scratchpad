/// <reference types="@cloudflare/workers-types" />

// Bindings configured in wrangler.jsonc, injected into every Pages Function.
export interface Env {
  DB: D1Database; // index: items, shares, links, settings
  BUCKET: R2Bucket; // blobs: content/<id>, uploads/<token>.<ext>
  ASSETS: Fetcher; // the static SPA (web/dist), used by the share page
  SCRATCHPAD_PASSWORD?: string; // empty/unset = open (no auth)
  APP_NAME?: string;
  SHARE_BASE_URL?: string;
}

// Metadata row (camelCase — the shape the SPA expects from the API).
export interface Item {
  id: string;
  title: string;
  type: string;
  path: string;
  language: string;
  folder: string;
  archived: boolean;
  trashed: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Share {
  token: string;
  itemId: string;
  expiresAt: number; // 0 = never
  createdAt: number;
}
