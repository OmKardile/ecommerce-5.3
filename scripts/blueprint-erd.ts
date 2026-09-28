/**
 * Blueprint ERD generator — renders scripts/schema.dbml into a
 * domain-clustered SVG diagram at public/schema-diagram.svg.
 *
 * Pipeline: DBML → (dbml-renderer) DOT → inject per-domain clusters + spacing
 * → (graphviz dot) SVG. Regenerate whenever prisma/schema.prisma changes:
 *
 *   bun scripts/blueprint-erd.ts
 *
 * Domains mirror the system guide page (/index-help.html, Section 3) so the
 * canvas and the cards always tell the same story. Money = integer paise notes
 * stay in the DBML.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const DBML = path.join(ROOT, "scripts/schema.dbml");
const OUT_SVG = path.join(ROOT, "public/schema-diagram.svg");

/** Domain grouping — MUST match the blueprint page's Section 3 domain cards. */
const DOMAINS: Array<{ name: string; color: string; tables: string[] }> = [
  { name: "Identity & Access", color: "#1A3C34", tables: ["users", "otp_verifications", "customers", "addresses"] },
  { name: "Catalog", color: "#7A5C2E", tables: ["categories", "brands", "products", "product_images", "product_variants", "skus"] },
  { name: "Inventory & Stock ops", color: "#2E5E4E", tables: ["inventory", "inventory_movements", "stock_count_sessions", "stock_count_lines", "stock_adjustment_requests"] },
  { name: "Cart & Wishlist", color: "#4E5E2E", tables: ["carts", "cart_items", "Wishlist", "WishlistItem"] },
  { name: "Orders & Fulfillment", color: "#6B2E2E", tables: ["orders", "order_items", "order_status_history", "payments", "payment_events", "shipments", "shipment_events", "order_returns"] },
  { name: "Marketing & Content", color: "#51355A", tables: ["coupons", "coupon_redemptions", "banners", "posts", "reviews", "b2b_inquiries", "stock_alerts"] },
  { name: "Kit Builder", color: "#7A5C2E", tables: ["bundles", "bundle_items"] },
  { name: "Platform", color: "#37352F", tables: ["audit_logs", "settings"] },
];

function sh(cmd: string, args: string[], cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    console.error(`${cmd} failed:\n${r.stdout?.slice(0, 2000)}\n${r.stderr?.slice(0, 2000)}`);
    process.exit(1);
  }
  return r.stdout;
}

// ── 1. DBML → DOT (renderer chokes on SQL-style '' escapes, patch a temp copy) ──
const tmpDbml = "/tmp/erd-render.dbml";
const tmpDot = "/tmp/erd-clustered.dot";
const dbml = readFileSync(DBML, "utf8").replaceAll("''", "'");
writeFileSync(tmpDbml, dbml);
sh("bunx", ["@softwaretechnik/dbml-renderer", "-i", tmpDbml, "-f", "dot", "-o", "/tmp/erd-base.dot"]);

// ── 2. Parse the flat DOT into header / node segments / edges ──
const dot = readFileSync("/tmp/erd-base.dot", "utf8");
const lines = dot.split("\n");

const headerLines: string[] = [];
const nodeSegs = new Map<string, string[]>(); // tableName -> segment lines
const edgeLines: string[] = [];

let current: { name: string; buf: string[] } | null = null;
for (const line of lines) {
  const m = line.match(/^\s*"([A-Za-z_]\w*)" \[id=/);
  if (m && !current) {
    current = { name: m[1], buf: [line] };
    continue;
  }
  if (current) {
    current.buf.push(line);
    if (/>];\s*$/.test(line)) {
      nodeSegs.set(current.name, current.buf);
      current = null;
    }
    continue;
  }
  if (line.includes(" -> ")) {
    edgeLines.push(line.trim());
    continue;
  }
  if (nodeSegs.size === 0) headerLines.push(line);
}

// Collect table names actually present (guard against DBML drift)
const known = new Set(nodeSegs.keys());
for (const d of DOMAINS) {
  for (const t of d.tables) {
    if (!known.has(t)) console.warn(`⚠ domain "${d.name}" references unknown table "${t}"`);
  }
}
const ungrouped = [...known].filter((t) => !DOMAINS.some((d) => d.tables.includes(t)));
if (ungrouped.length) console.warn(`⚠ tables not in any domain: ${ungrouped.join(", ")}`);

// ── 3. Rebuild the DOT with one rounded cluster per domain ──
const compact = (s: string) => s.replace(/fontsize="32(\.00)?"/g, 'fontsize="19"').replace(/CELLPADDING="10"/g, 'CELLPADDING="6"').replace(/CELLSPACING="0"/g, 'CELLSPACING="0"');
const CLUSTER_TINTS: Record<string, string> = {
  "#1A3C34": "#E7EFEA", "#7A5C2E": "#F5EEE2", "#2E5E4E": "#E4F0EB", "#4E5E2E": "#EFF2E2",
  "#6B2E2E": "#F4E7E7", "#51355A": "#EFE8F2", "#37352F": "#ECEBE8",
};

const out: string[] = [];
out.push("digraph dbml {");
out.push('  rankdir=TB; newrank=true; compound=true; pad="0.4";');
out.push('  graph [fontname="helvetica", fontsize=26, fontcolor="#29235C", bgcolor="transparent", nodesep=0.34, ranksep="1.1"];');
out.push('  node [penwidth=0, margin=0, fontname="helvetica", fontsize=19, fontcolor="#29235C"];');
out.push('  edge [fontname="helvetica", fontsize=15, fontcolor="#51355A", color="#29235C"];');
out.push("");

for (const [i, d] of DOMAINS.entries()) {
  const present = d.tables.filter((t) => nodeSegs.has(t));
  if (!present.length) continue;
  const tint = CLUSTER_TINTS[d.color] ?? "#F1EFEA";
  out.push(`  subgraph cluster_${i} {`);
  out.push(`    label=<<B>${d.name.replaceAll("&", "&amp;")}</B> <FONT POINT-SIZE="15">(${present.length})</FONT>>;`);
  out.push(`    labeljust="l"; fontname="helvetica-bold"; fontcolor="${d.color}";`);
  out.push(`    style="rounded,filled"; fillcolor="${tint}"; color="${d.color}"; penwidth=2.2; margin=14;`);
  for (const t of present) out.push(...nodeSegs.get(t)!.map((l) => "  " + compact(l)));
  out.push("  }");
  out.push("");
}

// Real reference edges only — the renderer's invisible ordering edges forced
// the single-column tower, drop them.
for (const e of edgeLines) {
  if (/style=invis/.test(e)) continue;
  out.push("  " + compact(e));
}
out.push("}");

writeFileSync(tmpDot, out.join("\n"));

// ── 4. DOT → SVG ──
mkdirSync(path.dirname(OUT_SVG), { recursive: true });
sh("dot", ["-Tsvg", "-o", OUT_SVG, tmpDot]);

// ── 5. Report ──
const svg = readFileSync(OUT_SVG, "utf8");
const dim = svg.match(/<svg width="([\d.]+)pt" height="([\d.]+)pt"/);
const nodes = [...svg.matchAll(/class="node"/g)].length;
const edges = [...svg.matchAll(/<path [^>]*class="edge"/g)].length || (svg.match(/<g id="edge/g) ?? []).length;
console.log(`✓ ${OUT_SVG}`);
console.log(`  size: ${dim?.[1] ?? "?"} x ${dim?.[2] ?? "?"} pt · ${nodes} tables · ${svg.length} bytes`);
rmSync(tmpDbml, { force: true });
