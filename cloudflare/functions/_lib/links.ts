// Extract the de-duplicated [[Title]] wiki-link targets from content (port of
// internal/items/items.go extractLinks).
const WIKI = /\[\[([^\[\]]+)\]\]/g;

export function extractLinks(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of content.matchAll(WIKI)) {
    const t = m[1].trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
