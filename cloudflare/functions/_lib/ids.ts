// Id / slug helpers — ports of internal/items/items.go and share_handlers.go so
// ids and filenames match the Go app's conventions.

// Lowercase RFC-4648 base32 (Go's base32.StdEncoding + ToLower), no padding.
const B32 = "abcdefghijklmnopqrstuvwxyz234567";
function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Short, URL-safe, lowercase id (5 random bytes → 8 chars).
export function newID(): string {
  return base32(randomBytes(5));
}

// 16-char lowercase share token (10 random bytes).
export function newShareToken(): string {
  return base32(randomBytes(10));
}

// Filesystem-safe, readable slug from a title (port of Go slug()).
export function slug(title: string): string {
  let sb = "";
  let lastDash = false;
  for (const r of title.toLowerCase()) {
    if ((r >= "a" && r <= "z") || (r >= "0" && r <= "9")) {
      sb += r;
      lastDash = false;
    } else if (!lastDash && sb.length > 0) {
      sb += "-";
      lastDash = true;
    }
  }
  let out = sb.replace(/^-+|-+$/g, "");
  if (out.length > 50) out = out.slice(0, 50).replace(/^-+|-+$/g, "");
  return out || "untitled";
}

// Normalize a folder path: no leading/trailing slashes, no "." / "..", slug each
// segment (port of Go cleanFolder()).
export function cleanFolder(folder: string): string {
  const trimmed = folder.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "";
  return trimmed
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p && p !== "." && p !== "..")
    .map(slug)
    .join("/");
}
