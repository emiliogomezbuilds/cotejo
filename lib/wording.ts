// Shadow clause, enforced in code (Blueprint Condition 2): Cotejo never pressures, never sells and never
// recommends a laptop. scripts/verify.ts scans the app source for these patterns and fails the build if any
// appears. This file is the only place allowed to list them.

export const PRESSURE_PATTERNS: RegExp[] = [
  /compra\s+(ya|ahora|hoy)/i,
  /[uú]ltima\s+oportunidad/i,
  /date\s+prisa|ap[uú]rate/i,
  /solo\s+quedan|quedan\s+pocos/i,
  /\boferta\b/i,
  /\bdescuento\b/i,
  /\bpromoci[oó]n\b/i,
  /te\s+recomendamos/i,
  /mejor\s+(laptop|opci[oó]n|compra)/i,
  /garantiz/i,
  /100\s*%/,
  /no\s+te\s+lo\s+pierdas/i,
];

// No purchase links and no affiliate parameters anywhere in the product (Condition 5).
export const SELLER_PATTERNS: RegExp[] = [
  /https?:\/\/[^\s"'`]*(mercadolibre|amazon|liverpool|coppel|walmart|cyberpuerta|ebay|aliexpress)/i,
  /affiliate|aff_id|utm_source=|[?&]tag=/i,
];

export function isNeutral(text: string): boolean {
  return !PRESSURE_PATTERNS.some((re) => re.test(text)) && !SELLER_PATTERNS.some((re) => re.test(text));
}

export const DECISION_IS_YOURS =
  "La decisión es tuya. Cotejo no vende, no recomienda laptops y no tiene comisiones.";
export const SELF_DECLARED = "Datos declarados por ti, no verificados por Cotejo";
export const COVERAGE_LIMIT =
  "Cotejo solo revisa la laptop que tú describes contra 5 programas. No busca, compara ni ordena laptops, y no sabe nada de opciones usadas o reacondicionadas.";
