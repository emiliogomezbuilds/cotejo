// Input validation (Security Floor #4): length limits and type checks on every form.
// Nothing goes raw from a text box into the database or into a prompt.

export function text(v: FormDataEntryValue | null, min: number, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return s.length >= min && s.length <= max ? s : null;
}

export function oneOf<T extends string>(v: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

export function uuid(v: FormDataEntryValue | null): string | null {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v) ? v : null;
}

/** Whole pesos between 0 and 1,000,000, or null. Accepts "18,000" and "$18000". */
export function pesos(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s));
  return n >= 0 && n <= 1_000_000 ? n : null;
}
