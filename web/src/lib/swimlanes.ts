// Diagram source → mermaid. If the text already starts with a mermaid diagram
// keyword (or `---` frontmatter) it's passed through untouched. Otherwise it's
// treated as swimlanes.io-style sequence syntax and transpiled to a mermaid
// `sequenceDiagram`. Covers the common swimlanes constructs — full-fidelity
// swimlanes rendering is out of scope; this is a pragmatic wrapper.

const MERMAID_KW = new Set([
  "sequenceDiagram", "flowchart", "graph", "gantt", "classDiagram", "stateDiagram",
  "stateDiagram-v2", "erDiagram", "journey", "pie", "mindmap", "timeline", "gitGraph",
  "quadrantChart", "requirementDiagram", "sankey-beta", "xychart-beta", "block-beta",
  "packet-beta", "architecture-beta", "C4Context", "C4Container", "zenuml",
]);

export function isMermaid(code: string): boolean {
  const first = code
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("//") && !l.startsWith("%%"));
  if (!first) return true; // empty → let mermaid show its own hint
  if (first.startsWith("---")) return true; // yaml frontmatter
  return MERMAID_KW.has(first.split(/\s/)[0]);
}

// swimlanes arrow op → mermaid arrow (and whether to swap the two actors).
const ARROWS: Record<string, { m: string; swap?: boolean }> = {
  "->": { m: "->>" },
  "->>": { m: "->>" },
  "-->": { m: "-->>" },
  "-->>": { m: "-->>" },
  "-x": { m: "-x" },
  "<->": { m: "->>" }, // mermaid has no bidirectional
  "=>": { m: "->>" }, // bold → solid
  "<-": { m: "->>", swap: true },
  "<--": { m: "-->>", swap: true },
};
// Longest ops first so "-->>" wins over "->".
const OP_RE = new RegExp("(" + Object.keys(ARROWS).sort((a, b) => b.length - a.length).map((o) => o.replace(/[-]/g, "\\-").replace(/[<>]/g, "\\$&")).join("|") + ")");

function transpile(code: string): string {
  const out: string[] = ["sequenceDiagram"];
  const actors: string[] = [];
  const seen = (a: string) => {
    if (a && !actors.includes(a)) actors.push(a);
  };

  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("//")) {
      out.push("  %% " + line.slice(2).trim());
      continue;
    }
    const lower = line.toLowerCase();
    if (lower === "autonumber") { out.push("  autonumber"); continue; }
    if (lower.startsWith("title:")) { out.push("  %% " + line); continue; }
    if (lower.startsWith("order:")) {
      for (const a of line.slice(6).split(",").map((s) => s.trim()).filter(Boolean)) {
        seen(a);
        out.push(`  participant ${a}`);
      }
      continue;
    }
    if (lower.startsWith("if:")) { out.push(`  alt ${line.slice(3).trim()}`); continue; }
    if (lower === "else" || lower.startsWith("else:")) { out.push(`  else ${line.replace(/^else:?/i, "").trim()}`); continue; }
    if (lower.startsWith("group:")) { out.push("  rect rgb(238,238,238)"); continue; }
    if (lower === "end") { out.push("  end"); continue; }
    if (lower === "..." || line === "-" || line === "--" || line === "=") continue; // delay / dividers
    // notes:  "note A, B: text"  or  "note: text"
    const noteM = /^note\b\s*([^:]*):\s*(.*)$/i.exec(line);
    if (noteM) {
      const targets = noteM[1].split(",").map((s) => s.trim()).filter(Boolean);
      targets.forEach(seen);
      const over = targets.length ? targets.join(",") : actors.slice(0, 2).join(",") || "note";
      out.push(`  note over ${over}: ${noteM[2]}`);
      continue;
    }
    // message:  A <op> B: text
    const mIdx = line.search(OP_RE);
    if (mIdx >= 0) {
      const m = OP_RE.exec(line)!;
      const op = m[1];
      const lhs = line.slice(0, m.index).trim();
      const rest = line.slice(m.index + op.length);
      const colon = rest.indexOf(":");
      const rhs = (colon >= 0 ? rest.slice(0, colon) : rest).trim();
      const text = colon >= 0 ? rest.slice(colon + 1).trim() : "";
      if (lhs && rhs) {
        seen(lhs);
        seen(rhs);
        const { m: arrow, swap } = ARROWS[op];
        const [a, b] = swap ? [rhs, lhs] : [lhs, rhs];
        out.push(`  ${a}${arrow}${b}: ${text}`);
        continue;
      }
    }
    out.push("  %% " + line); // unrecognized → keep as comment
  }
  return out.join("\n");
}

// Public: turn editor text into renderable mermaid.
export function toMermaid(code: string): string {
  return isMermaid(code) ? code : transpile(code);
}
