// The only facts about a laptop that Cotejo uses. Every field is DECLARED by the student (typed, or
// proposed by a model and then confirmed by her). "unknown" / null always stays unknown: it is never
// turned into a pass or a fail.

export const OS_KEYS = ["win11_home", "win11_pro", "win10", "macos", "other", "unknown"] as const;
export type OsKey = (typeof OS_KEYS)[number];
export const ARCHS = ["x86_64", "arm", "unknown"] as const;
export type Arch = (typeof ARCHS)[number];
export const GPU_KINDS = ["dedicated", "integrated", "unknown"] as const;
export type GpuKind = (typeof GPU_KINDS)[number];
export const TRI = ["yes", "no", "unknown"] as const;
export type Tri = (typeof TRI)[number];

export type Specs = {
  os: OsKey;
  win11_24h2: Tri; // does Windows 11 have the 24H2 update (or newer)? only asked for Windows 11
  macVersion: number | null; // macOS major version, e.g. 14, 15, 26
  arch: Arch; // x86_64 = Intel or AMD; arm = Qualcomm Snapdragon (Windows) or Apple silicon (Mac)
  ramGb: number | null;
  storageGb: number | null; // total capacity, NOT free space
  gpuKind: GpuKind;
  vramGb: number | null; // dedicated graphics memory only
  priceMxn: number | null;
};

export const EMPTY_SPECS: Specs = {
  os: "unknown", win11_24h2: "unknown", macVersion: null, arch: "unknown",
  ramGb: null, storageGb: null, gpuKind: "unknown", vramGb: null, priceMxn: null,
};

export type Platform = "windows" | "macos";
export function platformOf(os: OsKey): Platform | null {
  if (os === "win11_home" || os === "win11_pro" || os === "win10") return "windows";
  if (os === "macos") return "macos";
  return null;
}
export const isWin11 = (os: OsKey) => os === "win11_home" || os === "win11_pro";

export const OS_LABEL: Record<OsKey, string> = {
  win11_home: "Windows 11 Home",
  win11_pro: "Windows 11 Pro (o Educación / Empresarial)",
  win10: "Windows 10",
  macos: "macOS",
  other: "Otro (Linux, ChromeOS, sin sistema…)",
  unknown: "No lo sé",
};
export const ARCH_LABEL: Record<Arch, string> = {
  x86_64: "Intel o AMD",
  arm: "ARM (Snapdragon en Windows, o Apple silicon en Mac)",
  unknown: "No lo sé",
};

export const FIELD_COUNT = 8;

// ---------------------------------------------------------------- strict parsing of untrusted input
function num(v: unknown, min: number, max: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}
function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Turns anything (form values, model JSON) into a valid Specs. Invalid values become "unknown", never a guess. */
export function coerceSpecs(raw: Record<string, unknown>): Specs {
  const os = pick(raw.os, OS_KEYS, "unknown");
  const macVersion = os === "macos" ? num(raw.macVersion, 10, 60) : null;
  const gpuKind = pick(raw.gpuKind, GPU_KINDS, "unknown");
  const vram = gpuKind === "dedicated" ? num(raw.vramGb, 0, 128) : null;
  return {
    os,
    win11_24h2: isWin11(os) ? pick(raw.win11_24h2, TRI, "unknown") : "unknown",
    macVersion: macVersion === null ? null : Math.floor(macVersion),
    arch: pick(raw.arch, ARCHS, "unknown"),
    ramGb: num(raw.ramGb, 1, 1024),
    storageGb: num(raw.storageGb, 1, 20000),
    gpuKind,
    vramGb: vram,
    priceMxn: num(raw.priceMxn, 1, 1_000_000),
  };
}

/** Number of the 8 declared fields that are not "unknown" (used for the intake-benefit log). */
export function declaredFields(s: Specs): number {
  return [s.os !== "unknown", s.arch !== "unknown", s.ramGb !== null, s.storageGb !== null, s.gpuKind !== "unknown",
    s.vramGb !== null, s.priceMxn !== null, (isWin11(s.os) && s.win11_24h2 !== "unknown") || (s.os === "macos" && s.macVersion !== null)].filter(Boolean).length;
}

/** How many fields differ between what a model proposed and what the student confirmed. */
export function changedFields(proposed: Specs, confirmed: Specs): number {
  const keys = Object.keys(EMPTY_SPECS) as (keyof Specs)[];
  return keys.filter((k) => proposed[k] !== confirmed[k]).length;
}

const known = (v: unknown) => v !== null && v !== "unknown";
/** Overlay `add` on `base`, keeping base values wherever `add` is unknown. */
export function mergeSpecs(base: Specs, add: Specs): Specs {
  const out = { ...base } as Record<string, unknown>;
  (Object.keys(add) as (keyof Specs)[]).forEach((k) => { if (known(add[k])) out[k] = add[k]; });
  return out as Specs;
}
