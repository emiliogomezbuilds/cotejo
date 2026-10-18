// Regression checks. Run: npm run verify. Exits non-zero if any check fails.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CATALOG, CATALOG_VERSION, SOFTWARE, SOFTWARE_IDS, type Req } from "../lib/catalog";
import { budgetStatus, checkSoftware, runCheck } from "../lib/engine";
import { EMPTY_SPECS, changedFields, coerceSpecs, declaredFields, type Specs } from "../lib/specs";
import { parseIntake, parseVision } from "../lib/ai";
import { PRESSURE_PATTERNS, SELLER_PATTERNS, isNeutral } from "../lib/wording";
import { oneOf, pesos, text, uuid } from "../lib/validate";

let fails = 0;
let passes = 0;
function ok(cond: boolean, name: string, extra?: unknown) {
  if (cond) passes++;
  else {
    fails++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
}
const eq = (a: unknown, b: unknown, name: string) => ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b });
const S = (p: Partial<Specs>): Specs => ({ ...EMPTY_SPECS, ...p });
const get = (software: Parameters<typeof checkSoftware>[0], p: Partial<Specs>, id: string) =>
  checkSoftware(software, S(p)).results.find((r) => r.reqId === id);

// ================================================================ 1. catalog validator (Condition 1)
export function validateCatalog(catalog: Req[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const r of catalog) {
    if (ids.has(r.id)) errs.push(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (!r.id.startsWith(`${r.software}.${r.platform === "windows" ? "win" : "mac"}.`)) errs.push(`id prefix ${r.id}`);
    if (!r.quote || r.quote.trim().length < 8) errs.push(`no quote ${r.id}`);
    if (!/^https:\/\/[^\s]+$/.test(r.url)) errs.push(`bad url ${r.id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved)) errs.push(`bad date ${r.id}`);
    if (!r.label) errs.push(`no label ${r.id}`);
    if (r.rule.kind === "no_rule" && r.rule.why.length < 20) errs.push(`no_rule without reason ${r.id}`);
    if (r.rule.kind === "min_number") {
      const v = r.rule.value;
      const needle = r.rule.quoteHas ?? String(v);
      if (!r.quote.includes(needle)) errs.push(`value ${v} not found in the vendor quote of ${r.id}`);
      if (r.rule.armValue !== undefined && !r.quote.includes(String(r.rule.armValue))) errs.push(`arm value not in quote ${r.id}`);
    }
    if (r.rule.kind === "gpu" && !r.quote.includes(String(r.rule.minVramGb))) errs.push(`gpu value not in quote ${r.id}`);
    if (r.rule.kind === "mac_versions" && !r.quote.includes(String(r.rule.min))) errs.push(`mac version not in quote ${r.id}`);
  }
  return errs;
}
/** Two entries for the same software, platform, field kind and level must not disagree on the number. */
export function findContradictions(catalog: Req[]): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const r of catalog) {
    if (r.rule.kind !== "min_number") continue;
    const key = `${r.software}|${r.platform}|${r.rule.field}|${r.level}|${r.rule.whenArch ?? ""}`;
    const prev = seen.get(key);
    if (prev !== undefined && prev !== r.rule.value) out.push(`contradiction on ${key}`);
    seen.set(key, r.rule.value);
  }
  return out;
}
eq(validateCatalog(CATALOG), [], "catalog: every entry has a quote, a URL, a date and a number found in the vendor's words");
eq(findContradictions(CATALOG), [], "catalog: no contradictions");
ok(CATALOG.length >= 30, "catalog: has entries", CATALOG.length);
for (const sw of SOFTWARE) ok(CATALOG.some((r) => r.software === sw.id), `catalog: ${sw.id} has evidence`);
ok(/^\d{4}-\d{2}-\d{2}\.\d+$/.test(CATALOG_VERSION), "catalog: version format");
// the validator itself catches what it should (tests of the test)
const bad: Req = { ...CATALOG[0], id: "autocad.win.x", quote: "" };
ok(validateCatalog([bad]).length > 0, "validator rejects an entry with no quote");
const wrong = { ...CATALOG.find((r) => r.id === "solidworks.win.ram.min")!, id: "solidworks.win.ram.bad", rule: { kind: "min_number", field: "ramGb", value: 64, unit: "GB" } as Req["rule"] };
ok(validateCatalog([wrong]).some((e) => e.includes("not found")), "validator rejects a number that is not in the vendor's quote");
const dup = [CATALOG.find((r) => r.id === "solidworks.win.ram.min")!, { ...CATALOG.find((r) => r.id === "solidworks.win.ram.min")!, id: "solidworks.win.ram.min2", rule: { kind: "min_number", field: "ramGb", value: 8, unit: "GB" } as Req["rule"] }];
ok(findContradictions(dup).length === 1, "contradiction detector flags two different minimums for the same field");

// ================================================================ 2. engine: missing information is never a failure (Condition 3)
const onlyOs = runCheck([...SOFTWARE_IDS], S({ os: "win11_pro" }), null);
ok(onlyOs.reports.every((r) => r.results.every((x) => x.state !== "does_not_meet")), "unknown fields never produce a failure");
ok(onlyOs.reports.every((r) => r.results.some((x) => x.reason === "missing_input")), "unknown fields are reported as missing input");
eq(get("solidworks", { os: "win11_pro" }, "solidworks.win.ram.min")?.state, "cannot_decide", "unknown RAM is cannot_decide");
eq(get("solidworks", { os: "win11_pro", ramGb: 8 }, "solidworks.win.ram.min")?.state, "does_not_meet", "8 GB fails SOLIDWORKS minimum");
eq(get("solidworks", { os: "win11_pro", ramGb: 16 }, "solidworks.win.ram.min")?.state, "meets", "16 GB meets SOLIDWORKS minimum");
eq(get("solidworks", { os: "win11_pro", ramGb: 16 }, "solidworks.win.ram.rec")?.state, "below_recommended", "16 GB is below the 32 GB recommendation, not a failure");
eq(get("solidworks", { os: "win11_pro", ramGb: 32 }, "solidworks.win.ram.rec")?.state, "meets", "32 GB meets the recommendation");

// ---------------------------------------------------------------- operating-system traps found in the vendors' own pages
eq(get("solidworks", { os: "win11_home" }, "solidworks.win.os")?.state, "does_not_meet", "SOLIDWORKS: Windows Home is not supported");
eq(get("solidworks", { os: "win11_pro" }, "solidworks.win.os")?.state, "meets", "SOLIDWORKS: Windows 11 Pro meets");
eq(get("solidworks", { os: "win10" }, "solidworks.win.os")?.state, "does_not_meet", "SOLIDWORKS 2026+: Windows 10 not supported");
eq(get("solidworks", { os: "macos", macVersion: 15 }, "solidworks.mac.os")?.state, "cannot_decide", "SOLIDWORKS on macOS: not listed");
eq(get("solidworks", { os: "macos", macVersion: 15 }, "solidworks.mac.os")?.reason, "not_listed", "SOLIDWORKS on macOS: reason not_listed");
eq(get("solidworks", { arch: "arm", os: "win11_pro" }, "solidworks.win.arch")?.state, "does_not_meet", "SOLIDWORKS: ARM does not meet x86_64");
eq(get("premiere", { os: "win10" }, "premiere.win.os")?.state, "does_not_meet", "Premiere: Windows 10 does not meet");
eq(get("premiere", { os: "win11_home", win11_24h2: "unknown" }, "premiere.win.build")?.state, "cannot_decide", "Premiere: Windows 11 build unknown");
eq(get("premiere", { os: "win11_home", win11_24h2: "yes" }, "premiere.win.build")?.state, "meets", "Premiere: 24H2 yes");
eq(get("premiere", { os: "win11_home", win11_24h2: "no" }, "premiere.win.build")?.state, "does_not_meet", "Premiere: 24H2 no");
eq(get("premiere", { os: "win10" }, "premiere.win.build"), undefined, "Windows 11 build rule does not apply to Windows 10");
eq(get("premiere", { os: "win11_pro", arch: "arm", ramGb: 8 }, "premiere.win.ram.min")?.state, "does_not_meet", "Premiere on Windows ARM needs 16 GB");
eq(get("premiere", { os: "win11_pro", arch: "x86_64", ramGb: 8 }, "premiere.win.ram.min")?.state, "meets", "Premiere on x86 needs 8 GB");
eq(get("matlab", { os: "win11_pro", arch: "arm" }, "matlab.win.arch")?.state, "cannot_decide", "MATLAB on ARM: emulation, chip unknown");
eq(get("matlab", { os: "win11_pro", arch: "x86_64" }, "matlab.win.arch")?.state, "meets", "MATLAB on x86-64 meets");
eq(get("matlab", { os: "win10" }, "matlab.win.os")?.state, "cannot_decide", "MATLAB Windows 10: needs version 22H2, unknown");
ok(/Python/.test(get("vs2022", { os: "win11_pro", arch: "arm" }, "vs2022.win.arch")?.caveat ?? ""), "Visual Studio on ARM carries the Python caveat");
eq(get("vs2022", { os: "win10" }, "vs2022.win.os")?.reason, "not_listed", "Visual Studio: Windows 10 not listed");

// ---------------------------------------------------------------- macOS
eq(get("autocad", { os: "macos", macVersion: 12 }, "autocad.mac.os")?.state, "does_not_meet", "AutoCAD: macOS 12 below minimum");
eq(get("autocad", { os: "macos", macVersion: 14 }, "autocad.mac.os")?.state, "meets", "AutoCAD: macOS 14 meets");
eq(get("autocad", { os: "macos", macVersion: 27 }, "autocad.mac.os")?.state, "cannot_decide", "AutoCAD: macOS newer than the list is undecided");
eq(get("autocad", { os: "macos" }, "autocad.mac.os")?.state, "cannot_decide", "AutoCAD: macOS version unknown");
eq(get("premiere", { os: "macos", macVersion: 26 }, "premiere.mac.os")?.state, "meets", "Premiere: 'Sonoma and later' accepts 26");
eq(get("premiere", { os: "macos", arch: "x86_64", ramGb: 8 }, "premiere.mac.ram.rec"), undefined, "Apple-silicon recommendation does not apply to Intel Macs");
eq(get("premiere", { os: "macos", arch: "unknown", ramGb: 8 }, "premiere.mac.ram.rec")?.state, "cannot_decide", "Apple-silicon recommendation is undecided when the chip type is unknown");
eq(get("autocad", { os: "macos", arch: "arm" }, "autocad.mac.arch")?.state, "meets", "AutoCAD: Apple M series meets");

// ---------------------------------------------------------------- GPU rules never pretend
eq(get("autocad", { os: "win11_pro", gpuKind: "integrated" }, "autocad.win.gpu.min")?.state, "cannot_decide", "integrated graphics: cannot_decide");
eq(get("autocad", { os: "win11_pro", gpuKind: "dedicated", vramGb: 1 }, "autocad.win.gpu.min")?.state, "does_not_meet", "1 GB dedicated fails a 2 GB minimum");
eq(get("autocad", { os: "win11_pro", gpuKind: "dedicated", vramGb: 4 }, "autocad.win.gpu.min")?.state, "cannot_decide", "4 GB dedicated: bandwidth and DirectX cannot be compared");
eq(get("autocad", { os: "win11_pro", gpuKind: "dedicated" }, "autocad.win.gpu.min")?.reason, "missing_input", "dedicated GPU without memory: missing input");
eq(get("autocad", { os: "win11_pro" }, "autocad.win.cpu")?.state, "cannot_decide", "CPU model comparisons are never invented");
eq(get("solidworks", { os: "win11_pro" }, "solidworks.win.gpu")?.state, "cannot_decide", "certified-cards rule is cannot_decide");

// ---------------------------------------------------------------- storage is capacity, said so
ok(/capacidad total/.test(get("autocad", { os: "win11_pro", storageGb: 512 }, "autocad.win.storage")?.detail ?? ""), "storage result states it is total capacity");
eq(get("autocad", { os: "win11_pro", storageGb: 8 }, "autocad.win.storage")?.state, "does_not_meet", "8 GB capacity fails a 10 GB minimum");

// ---------------------------------------------------------------- coverage limits and the no-evidence outcome
const vsMac = checkSoftware("vs2022", S({ os: "macos", macVersion: 15 }));
ok(vsMac.noEvidence && vsMac.results.length === 0 && /no tiene evidencia/.test(vsMac.message ?? ""), "no evidence loaded is its own outcome");
ok(checkSoftware("matlab", S({ os: "macos", macVersion: 15 })).noEvidence, "MATLAB macOS: no evidence loaded");
const other = checkSoftware("autocad", S({ os: "other" }));
ok(other.noEvidence, "unsupported OS family: no evidence loaded");
const unk = checkSoftware("autocad", S({ os: "unknown" }));
ok(!unk.noEvidence && unk.results.length === 0 && /Elige el sistema operativo/.test(unk.message ?? ""), "unknown OS asks for the OS, does not guess");
ok(checkSoftware("solidworks", S({ os: "win11_pro" })).notChecked.length > 0, "the 'not checked' list is not empty for Windows");

// ---------------------------------------------------------------- ordering, determinism, no overall grade
const sw = checkSoftware("solidworks", S({ os: "win11_home", ramGb: 16, arch: "x86_64" }));
eq(sw.results[0].state, "does_not_meet", "failures are listed first");
ok(sw.counts.does_not_meet >= 1 && sw.counts.cannot_decide >= 1 && sw.counts.meets >= 1, "counts add up", sw.counts);
eq(JSON.stringify(runCheck(["solidworks"], S({ os: "win11_home", ramGb: 16 }), 18000)), JSON.stringify(runCheck(["solidworks"], S({ os: "win11_home", ramGb: 16 }), 18000)), "deterministic: same input, same output");
const rep = runCheck(["solidworks"], S({ os: "win11_pro" }), null);
ok(!("grade" in rep) && !("score" in rep) && !("overall" in rep), "the report has no overall grade, score or label");
eq(rep.catalogVersion, CATALOG_VERSION, "report carries the catalog version");
// every result carries its evidence
const all = runCheck([...SOFTWARE_IDS], S({ os: "win11_pro", arch: "x86_64", ramGb: 16, storageGb: 512, gpuKind: "dedicated", vramGb: 4, win11_24h2: "yes" }), 18000);
ok(all.reports.every((r) => r.results.every((x) => x.quote.length > 0 && x.url.startsWith("https://") && /^\d{4}-\d{2}-\d{2}$/.test(x.retrieved))), "every result has quote, url and date");
ok(all.reports.every((r) => r.results.every((x) => isNeutral(x.detail))), "no result text uses pressure wording");

// ---------------------------------------------------------------- budget (a user constraint, never overridden)
eq(budgetStatus(17499, 18000).state, "within", "price within budget");
eq(budgetStatus(18001, 18000).state, "over", "price over budget");
eq(budgetStatus(null, 18000).state, "unknown", "unknown price: unknown");
eq(budgetStatus(17000, null).state, "unknown", "unknown budget: unknown");

// ================================================================ 3. strict input handling
eq(coerceSpecs({ os: "win11_pro", ramGb: "16", storageGb: "512", vramGb: 4, gpuKind: "dedicated" }).ramGb, 16, "numeric strings are accepted");
eq(coerceSpecs({ os: "hacker" }).os, "unknown", "invalid OS becomes unknown");
eq(coerceSpecs({ ramGb: -5 }).ramGb, null, "negative RAM becomes unknown");
eq(coerceSpecs({ ramGb: 99999 }).ramGb, null, "absurd RAM becomes unknown");
eq(coerceSpecs({ ramGb: "dieciséis" }).ramGb, null, "text RAM becomes unknown");
eq(coerceSpecs({ gpuKind: "integrated", vramGb: 8 }).vramGb, null, "integrated graphics keep no dedicated memory");
eq(coerceSpecs({ os: "win10", win11_24h2: "yes" }).win11_24h2, "unknown", "the 24H2 answer only counts on Windows 11");
eq(coerceSpecs({ os: "macos", macVersion: 15.7 }).macVersion, 15, "macOS version is a whole number");
eq(coerceSpecs({ os: "win11_pro", macVersion: 15 }).macVersion, null, "macOS version is ignored on Windows");
eq(declaredFields(EMPTY_SPECS), 0, "declaredFields: none");
eq(changedFields(S({ ramGb: 8, os: "win10" }), S({ ramGb: 16, os: "win10" })), 1, "changedFields counts edits");
eq(pesos("$18,000"), 18000, "pesos parses $18,000");
eq(pesos("abc"), null, "pesos rejects text");
eq(pesos("99999999"), null, "pesos rejects absurd values");
eq(text("  hola  ", 1, 10), "hola", "text trims");
eq(text("x".repeat(11), 1, 10), null, "text enforces max");
eq(oneOf("a", ["a", "b"] as const), "a", "oneOf allows");
eq(oneOf("c", ["a", "b"] as const), null, "oneOf rejects");
eq(uuid("not-a-uuid"), null, "uuid rejects junk");

// ================================================================ 4. model output is parsed strictly and never trusted
const intake = parseIntake(JSON.stringify({ software: ["autocad", "rm -rf", "solidworks", "autocad"], budgetMxn: 18000, specs: { os: "win11_home", ramGb: "16" } }));
eq(intake?.software, ["autocad", "solidworks"], "intake: unknown software ids are dropped, duplicates removed");
eq(intake?.specs.os, "win11_home", "intake: valid fields kept");
eq(intake?.budgetMxn, 18000, "intake: budget kept");
eq(parseIntake("not json"), null, "intake: malformed output rejected");
eq(parseIntake(JSON.stringify({ software: "autocad", budgetMxn: -1, specs: "x" }))?.budgetMxn, null, "intake: invalid budget dropped");
eq(parseVision("```json\n{\"os\":\"win11_pro\",\"ramGb\":16}\n```")?.ramGb, 16, "vision: fenced JSON accepted");
eq(parseVision("[1,2]"), null, "vision: arrays rejected");
eq(parseVision(JSON.stringify({ os: "<script>", ramGb: 1e9 }))?.os, "unknown", "vision: injected values become unknown");
// a model proposal never becomes a verdict: the engine takes Specs only, and the engine file does not import the AI module
ok(!readFileSync(join(__dirname, "../lib/engine.ts"), "utf8").includes("lib/ai"), "the engine does not import the AI module");

// ================================================================ 5. wording and seller scan (Condition 2 and 5)
const ROOT = join(__dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const sources = ["app", "components", "lib"].flatMap((d) => walk(join(ROOT, d))).filter((p) => !p.endsWith("wording.ts"));
for (const p of sources) {
  const body = readFileSync(p, "utf8");
  for (const re of PRESSURE_PATTERNS) ok(!re.test(body), `no pressure wording ${re} in ${p.replace(ROOT, "")}`);
  for (const re of SELLER_PATTERNS) ok(!re.test(body), `no seller link or affiliate pattern ${re} in ${p.replace(ROOT, "")}`);
}
ok(sources.length > 5, "scan covers the source tree", sources.length);
// catalog URLs are vendor pages only
ok(CATALOG.every((r) => /autodesk|mathworks|solidworks|adobe|microsoft/.test(r.url)), "catalog URLs are vendor pages");

// ================================================================ 6. schema and secrets (security floor)
const schema = readFileSync(join(ROOT, "supabase/schema.sql"), "utf8");
const schemaCode = schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const tables = [...schemaCode.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
ok(tables.length === 3, "schema has the three expected tables", tables);
for (const t of tables) ok(new RegExp(`alter table public\\.${t} enable row level security`).test(schemaCode), `RLS enabled on ${t}`);
ok(!/\b(score|grade|rating|puntaje|calificaci\w+)\b/i.test(schemaCode), "schema has no score, grade or rating column");
ok(!/\b(image|screenshot|photo|blob)\b/i.test(schemaCode.replace(/screenshots?/g, "")) || !/\bbytea\b/i.test(schemaCode), "schema stores no image data");
ok(!/\bip(_address)?\b/i.test(schemaCode), "schema stores no IP address");
const env = existsSync(join(ROOT, ".env.example")) ? readFileSync(join(ROOT, ".env.example"), "utf8") : "";
ok(/GEMINI_API_KEY=\s*$/m.test(env), ".env.example has an empty Gemini key");
ok(!sources.some((p) => /AIza[0-9A-Za-z_-]{20,}/.test(readFileSync(p, "utf8"))), "no API key pattern in the source");

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
