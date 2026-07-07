// Single-password gate with stateless HMAC-signed session cookies — a port of
// internal/httpapi/auth.go using Web Crypto. The signing secret is persisted in
// D1 settings so sessions survive across deploys. When SCRATCHPAD_PASSWORD is
// unset the app is open.
import type { Env } from "./types";

const COOKIE = "scratchpad_session";
const TTL_SECONDS = 30 * 24 * 60 * 60;

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function base64urlNoPad(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sessionSecret(env: Env): Promise<CryptoKey> {
  let b64 = (await env.DB.prepare("SELECT value FROM settings WHERE key = 'session_secret'").first<{ value: string }>())?.value;
  if (!b64) {
    const raw = crypto.getRandomValues(new Uint8Array(32));
    let s = "";
    for (const b of raw) s += String.fromCharCode(b);
    b64 = btoa(s);
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('session_secret', ?)").bind(b64).run();
  }
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function mac(key: CryptoKey, payload: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64urlNoPad(new Uint8Array(sig));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signToken(env: Env, expiryUnix: number): Promise<string> {
  const key = await sessionSecret(env);
  const payload = String(expiryUnix);
  return `${payload}.${await mac(key, payload)}`;
}

async function verifyToken(env: Env, tok: string): Promise<boolean> {
  const dot = tok.indexOf(".");
  if (dot < 0) return false;
  const payload = tok.slice(0, dot);
  const sig = tok.slice(dot + 1);
  const key = await sessionSecret(env);
  if (!timingSafeEqual(sig, await mac(key, payload))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() / 1000 < exp;
}

// True if the request is allowed (open app, or a valid session cookie).
export async function isAuthed(request: Request, env: Env): Promise<boolean> {
  if (!env.SCRATCHPAD_PASSWORD) return true;
  const tok = parseCookies(request.headers.get("Cookie"))[COOKIE];
  if (!tok) return false;
  return verifyToken(env, tok);
}

function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:" || request.headers.get("X-Forwarded-Proto") === "https";
}

// Set-Cookie value for a fresh 30-day session.
export async function sessionCookie(env: Env, request: Request): Promise<string> {
  const tok = await signToken(env, Math.floor(Date.now() / 1000) + TTL_SECONDS);
  const secure = isSecure(request) ? "; Secure" : "";
  return `${COOKIE}=${tok}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL_SECONDS}${secure}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`;
}

// Constant-time password check (open when no password configured).
export function passwordOK(env: Env, provided: string): boolean {
  if (!env.SCRATCHPAD_PASSWORD) return true;
  return timingSafeEqual(provided ?? "", env.SCRATCHPAD_PASSWORD);
}
