// The deterministic engine. No AI, no randomness, no network: the same specs and the same catalog
// version always give the same answer. Rules it follows (Blueprint Conditions 1 and 3):
//  - an unknown input NEVER becomes a failure or a pass: it becomes "cannot_decide";
//  - a requirement that cannot be turned into a rule says so and shows the vendor's words;
//  - there is no overall grade: results are listed one by one with their source;
//  - a platform with no evidence loaded says "no evidence loaded", which is not "does not meet".
import { CATALOG, CATALOG_VERSION, NOT_CHECKED, type Reason, type Req, type SoftwareId, type Verdict } from "@/lib/catalog";
import { OS_LABEL, isWin11, platformOf, type Platform, type Specs } from "@/lib/specs";

export type State = Verdict | "below_recommended";
export type Result = {
  reqId: string;
  software: SoftwareId;
  label: string;
  level: Req["level"];
  state: State;
  reason: Reason;
  detail: string;
  caveat?: string;
  quote: string;
  url: string;
  retrieved: string;
};
export type Counts = { meets: number; does_not_meet: number; cannot_decide: number; below_recommended: number };
export type SoftwareReport = {
  software: SoftwareId;
  platform: Platform | null;
  noEvidence: boolean;
  message?: string;
  results: Result[];
  notChecked: string[];
  counts: Counts;
};
export type BudgetStatus = { state: "within" | "over" | "unknown"; price: number | null; budget: number | null };
export type CheckReport = { catalogVersion: string; budget: BudgetStatus; reports: SoftwareReport[] };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

function mk(req: Req, state: State, reason: Reason, detail: string, extra?: { quote?: string; caveat?: string }): Result {
  return {
    reqId: req.id, software: req.software as SoftwareId, label: req.label, level: req.level, state, reason, detail,
    quote: extra?.quote ?? req.quote, url: req.url, retrieved: req.retrieved, ...(extra?.caveat ? { caveat: extra.caveat } : {}),
  };
}
const missing = (req: Req, what: string) =>
  mk(req, "cannot_decide", "missing_input", `No indicaste ${what}. Cotejo no puede decidir sin ese dato; no lo trata como fallo.`);

/** Evaluate one catalog entry against the declared specs. Returns null when the entry does not apply. */
export function evaluate(req: Req, s: Specs): Result | null {
  const rule = req.rule;
  const lvl = req.level;
  switch (rule.kind) {
    case "no_rule":
      return mk(req, "cannot_decide", "no_rule", rule.why);

    case "os_map": {
      if (s.os === "unknown") return missing(req, "tu sistema operativo");
      const e = rule.map[s.os];
      if (!e) return mk(req, "cannot_decide", "no_rule", `La página no dice nada sobre ${OS_LABEL[s.os]}.`);
      const detail = e.note ?? (e.state === "meets" ? `${OS_LABEL[s.os]} aparece como compatible.` : `${OS_LABEL[s.os]} no cumple.`);
      return mk(req, e.state, e.reason ?? (e.state === "meets" ? "ok" : "no_rule"), detail, { quote: e.quote });
    }

    case "win11_build": {
      if (!isWin11(s.os)) return null;
      if (s.win11_24h2 === "unknown") return mk(req, "cannot_decide", "missing_input", `El fabricante pide Windows 11 ${rule.need} y no indicaste si la tienes. Una laptop nueva puede traer una versión anterior.`);
      return s.win11_24h2 === "yes"
        ? mk(req, "meets", "ok", `Indicaste que tienes la actualización ${rule.need}.`)
        : mk(req, "does_not_meet", "below_minimum", `El fabricante pide Windows 11 ${rule.need} y indicaste que no la tienes.`);
    }

    case "mac_versions": {
      if (s.macVersion === null) return missing(req, "la versión de macOS");
      if (s.macVersion < rule.min) return mk(req, "does_not_meet", "below_minimum", `Tienes macOS ${s.macVersion}; el fabricante pide macOS ${rule.min} o más nuevo.`);
      if (rule.max !== undefined && s.macVersion > rule.max) return mk(req, "cannot_decide", "no_rule", `Tienes macOS ${s.macVersion}, más nuevo que la última versión que lista el fabricante (${rule.max}).`);
      return mk(req, "meets", "ok", `macOS ${s.macVersion} está en la lista del fabricante.`);
    }

    case "arch_map": {
      if (s.arch === "unknown") return missing(req, "el tipo de procesador (Intel/AMD o ARM)");
      const e = rule.map[s.arch];
      if (!e) return mk(req, "cannot_decide", "no_rule", "La página no dice nada sobre ese tipo de procesador.");
      return mk(req, e.state, e.reason ?? (e.state === "meets" ? "ok" : "no_rule"), e.note ?? (e.state === "meets" ? "Tipo de procesador compatible." : "Tipo de procesador no compatible."),
        { quote: e.quote, caveat: e.caveat });
    }

    case "min_number": {
      if (rule.whenArch) {
        if (s.arch === "unknown") return missing(req, "el tipo de procesador (esta regla depende de él)");
        if (s.arch !== rule.whenArch) return null;
      }
      const have = s[rule.field];
      const need = rule.armValue !== undefined && s.arch === "arm" ? rule.armValue : rule.value;
      const what = rule.field === "ramGb" ? "la memoria RAM" : "la capacidad de almacenamiento";
      if (have === null) return missing(req, what);
      const tail = rule.note ? ` ${rule.note}` : "";
      if (have >= need) return mk(req, "meets", "ok", `Tienes ${fmt(have)} ${rule.unit}; el fabricante ${lvl === "minimum" ? "pide como mínimo" : "recomienda"} ${fmt(need)} ${rule.unit}.${tail}`);
      return lvl === "minimum"
        ? mk(req, "does_not_meet", "below_minimum", `Tienes ${fmt(have)} ${rule.unit}; el fabricante pide como mínimo ${fmt(need)} ${rule.unit}.${tail}`)
        : mk(req, "below_recommended", "below_recommended", `Tienes ${fmt(have)} ${rule.unit}; el fabricante recomienda ${fmt(need)} ${rule.unit}. Esto no es un fallo: es una recomendación.${tail}`);
    }

    case "gpu": {
      if (s.gpuKind === "unknown") return missing(req, "el tipo de gráficos (integrados o dedicados)");
      if (s.gpuKind === "integrated") {
        return mk(req, "cannot_decide", "no_rule", `Los gráficos integrados comparten memoria con el sistema y el fabricante pide ${fmt(rule.minVramGb)} GB de memoria de GPU; no hay una regla para compararlos.`);
      }
      if (s.vramGb === null) return missing(req, "la memoria de la tarjeta dedicada");
      if (s.vramGb < rule.minVramGb) {
        return lvl === "minimum"
          ? mk(req, "does_not_meet", "below_minimum", `Tu tarjeta dedicada tiene ${fmt(s.vramGb)} GB; el fabricante pide al menos ${fmt(rule.minVramGb)} GB.`)
          : mk(req, "below_recommended", "below_recommended", `Tu tarjeta dedicada tiene ${fmt(s.vramGb)} GB; el fabricante recomienda ${fmt(rule.minVramGb)} GB. No es un fallo.`);
      }
      return rule.alsoNeeds
        ? mk(req, "cannot_decide", "no_rule", `La memoria (${fmt(s.vramGb)} GB) alcanza, pero el fabricante también exige ${rule.alsoNeeds}, y eso no se puede comparar sin el modelo exacto de la tarjeta.`)
        : mk(req, "meets", "ok", `Tu tarjeta dedicada tiene ${fmt(s.vramGb)} GB; el fabricante pide ${fmt(rule.minVramGb)} GB.`);
    }
  }
}

const zero = (): Counts => ({ meets: 0, does_not_meet: 0, cannot_decide: 0, below_recommended: 0 });

export function platformLabel(p: Platform | null) {
  return p === "windows" ? "Windows" : p === "macos" ? "macOS" : "tu sistema";
}

export function checkSoftware(software: SoftwareId, s: Specs, catalog: Req[] = CATALOG): SoftwareReport {
  const platform = platformOf(s.os);
  const base = { software, platform, notChecked: platform ? NOT_CHECKED[software][platform] ?? [] : [] };
  if (s.os === "unknown") {
    return { ...base, noEvidence: false, results: [], counts: zero(), message: "Elige el sistema operativo de la laptop para poder revisar este programa." };
  }
  if (!platform) {
    return { ...base, noEvidence: true, results: [], counts: zero(), message: `Cotejo no tiene evidencia cargada para ${OS_LABEL[s.os]}. Eso no significa que no funcione: consulta la página del fabricante.` };
  }
  const reqs = catalog.filter((r) => r.software === software && r.platform === platform);
  if (reqs.length === 0) {
    return { ...base, noEvidence: true, results: [], counts: zero(), message: `Cotejo no tiene evidencia cargada de este programa para ${platformLabel(platform)}. Eso no significa que no funcione: consulta la página del fabricante.` };
  }
  const results = reqs.map((r) => evaluate(r, s)).filter((x): x is Result => x !== null);
  const counts = zero();
  results.forEach((x) => (counts[x.state] += 1));
  // Failures first, then unresolved, then below-recommended, then passes: the bad news is never buried.
  const order: Record<State, number> = { does_not_meet: 0, cannot_decide: 1, below_recommended: 2, meets: 3 };
  results.sort((a, b) => order[a.state] - order[b.state]);
  return { ...base, noEvidence: false, results, counts };
}

export function budgetStatus(price: number | null, budget: number | null): BudgetStatus {
  if (price === null || budget === null) return { state: "unknown", price, budget };
  return { state: price <= budget ? "within" : "over", price, budget };
}

export function runCheck(softwareIds: SoftwareId[], s: Specs, budget: number | null, catalog: Req[] = CATALOG): CheckReport {
  return { catalogVersion: CATALOG_VERSION, budget: budgetStatus(s.priceMxn, budget), reports: softwareIds.map((id) => checkSoftware(id, s, catalog)) };
}
