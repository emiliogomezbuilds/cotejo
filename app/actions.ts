"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CONSENT_VERSION, requireUser } from "@/lib/session";
import { pesos, text, uuid } from "@/lib/validate";
import { CATALOG, CATALOG_VERSION, SOFTWARE_IDS, swName, type SoftwareId } from "@/lib/catalog";
import { coerceSpecs, changedFields, declaredFields, platformOf, type Specs } from "@/lib/specs";
import { runCheck, type CheckReport } from "@/lib/engine";
import { AI_IMAGE_MAX_BYTES, AI_TEXT_MAX, IMAGE_TYPES, intakeFromText, specsFromImage } from "@/lib/ai";

const AI_DAILY_LIMIT = 30; // protects the free-tier key; each AI use is logged as a consent row

// ------------------------------------------------------------------ helpers
function specsFrom(fd: FormData): Specs {
  const g = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : "";
  };
  return coerceSpecs({
    os: g("os"), win11_24h2: g("win11_24h2"), macVersion: g("macVersion"), arch: g("arch"),
    ramGb: g("ramGb"), storageGb: g("storageGb"), gpuKind: g("gpuKind"), vramGb: g("vramGb"), priceMxn: g("priceMxn"),
  });
}
function softwareFrom(fd: FormData): SoftwareId[] {
  const ids = fd.getAll("software").map(String).filter((x): x is SoftwareId => (SOFTWARE_IDS as readonly string[]).includes(x));
  return [...new Set(ids)];
}
function proposedFrom(fd: FormData): Specs | null {
  const raw = fd.get("ai_proposed");
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return null;
  try {
    const j = JSON.parse(raw);
    return j && typeof j === "object" && !Array.isArray(j) ? coerceSpecs(j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
async function aiAllowed(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("consents").select("id", { count: "exact", head: true }).in("purpose", ["ai_text", "ai_image"]).gte("created_at", since);
  return (count ?? 0) < AI_DAILY_LIMIT;
}
async function logConsent(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], purpose: "ai_text" | "ai_image" | "process_data") {
  await supabase.from("consents").insert({ purpose, granted: true, text_version: CONSENT_VERSION });
}
const aiErrorMessage = (e: { error: string; status?: number }) =>
  e.error === "no_key" ? "La lectura con IA no está configurada en este servidor. Llena los datos a mano: la revisión funciona igual."
  : e.error === "too_long" ? `El texto es muy largo (máximo ${AI_TEXT_MAX} caracteres).`
  : e.error === "bad_output" ? "La IA no devolvió algo que pudiéramos usar. Llena los datos a mano."
  : `La IA no estuvo disponible ahora${e.status ? ` (código ${e.status})` : ""}. Llena los datos a mano: la revisión funciona igual.`;

// ------------------------------------------------------------------ 1. optional helpers (model PROPOSES, never decides)
export type IntakeResult = { error?: string; proposal?: { software: SoftwareId[]; budgetMxn: number | null; specs: Specs } };
export async function intakeAction(fd: FormData): Promise<IntakeResult> {
  const { supabase } = await requireUser();
  if (fd.get("consent_ai_text") !== "on") return { error: "Para usar la ayuda con texto necesitamos tu permiso. Marca la casilla." };
  const t = text(fd.get("free_text"), 5, AI_TEXT_MAX);
  if (!t) return { error: `Escribe entre 5 y ${AI_TEXT_MAX} caracteres.` };
  if (!(await aiAllowed(supabase))) return { error: "Llegaste al límite diario de ayuda con IA. Llena los datos a mano." };
  await logConsent(supabase, "ai_text");
  const res = await intakeFromText(t);
  return res.ok ? { proposal: res.value } : { error: aiErrorMessage(res) };
}

export type VisionResult = { error?: string; proposal?: { specs: Specs } };
export async function visionAction(fd: FormData): Promise<VisionResult> {
  const { supabase } = await requireUser();
  if (fd.get("consent_ai_image") !== "on") return { error: "Para leer la captura necesitamos tu permiso. Marca la casilla." };
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige una captura de pantalla del anuncio." };
  if (file.size > AI_IMAGE_MAX_BYTES) return { error: "La imagen pesa más de 4 MB. Usa una captura más pequeña." };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return { error: "Solo aceptamos imágenes PNG, JPG o WebP." };
  if (!(await aiAllowed(supabase))) return { error: "Llegaste al límite diario de ayuda con IA. Llena los datos a mano." };
  await logConsent(supabase, "ai_image");
  const b64 = Buffer.from(await file.arrayBuffer()).toString("base64"); // processed in memory, never stored
  const res = await specsFromImage(file.type, b64);
  return res.ok ? { proposal: { specs: res.value } } : { error: aiErrorMessage(res) };
}

// ------------------------------------------------------------------ 2. the check (deterministic, stateless)
export type CheckPayload = {
  software: SoftwareId[];
  budgetMxn: number | null;
  specs: Specs;
  proposed: Specs | null;
  usedText: boolean;
  usedImage: boolean;
  isSample: boolean;
  report: CheckReport;
};
export type CheckState = { error?: string; result?: CheckPayload };

export async function checkAction(_prev: CheckState, fd: FormData): Promise<CheckState> {
  await requireUser();
  const software = softwareFrom(fd);
  if (software.length === 0) return { error: "Elige al menos un programa." };
  const budgetRaw = fd.get("budgetMxn");
  const budgetMxn = typeof budgetRaw === "string" && budgetRaw.trim() ? pesos(budgetRaw) : null;
  if (typeof budgetRaw === "string" && budgetRaw.trim() && budgetMxn === null) return { error: "El presupuesto debe ser una cantidad en pesos, por ejemplo 18000." };
  const specs = specsFrom(fd);
  const proposed = proposedFrom(fd);
  // Condition 2: a field proposed by a model is used only after the student confirms she reviewed it.
  if (proposed && fd.get("confirm_ai") !== "on") return { error: "Revisa los campos que propuso la IA (están marcados) y marca la casilla de confirmación." };
  const report = runCheck(software, specs, budgetMxn);
  return {
    result: {
      software, budgetMxn, specs, proposed, usedText: fd.get("used_text") === "1", usedImage: fd.get("used_image") === "1",
      isSample: fd.get("is_sample") === "1", report,
    },
  };
}

// ------------------------------------------------------------------ 3. save (re-computed on the server; the browser is never trusted)
export type SaveState = { error?: string };
export async function saveCheckAction(_prev: SaveState, fd: FormData): Promise<SaveState> {
  const { supabase } = await requireUser();
  if (fd.get("consent_process") !== "on") return { error: "Para guardar necesitamos tu permiso. Marca la casilla." };
  const software = softwareFrom(fd);
  if (software.length === 0) return { error: "Faltan datos. Vuelve a hacer la revisión." };
  const budgetRaw = fd.get("budgetMxn");
  const budgetMxn = typeof budgetRaw === "string" && budgetRaw.trim() ? pesos(budgetRaw) : null;
  const specs = specsFrom(fd);
  if (specs.os === "unknown") return { error: "Falta el sistema operativo: sin ese dato no hay nada que guardar." };
  const proposed = proposedFrom(fd);
  const report = runCheck(software, specs, budgetMxn); // never taken from the client
  const titleDefault = `Laptop ${platformOf(specs.os) === "macos" ? "macOS" : platformOf(specs.os) === "windows" ? "Windows" : ""} · ${software.map(swName).join(", ")}`.replace(/\s+/g, " ").slice(0, 80);
  const title = text(fd.get("title"), 1, 80) ?? titleDefault;
  const { data, error } = await supabase
    .from("checks")
    .insert({
      title, software_ids: software, specs, budget_mxn: budgetMxn, verdicts: report.reports, catalog_version: CATALOG_VERSION,
      is_sample: fd.get("is_sample") === "1", used_text_helper: fd.get("used_text") === "1", used_screenshot: fd.get("used_image") === "1",
      ai_fields_proposed: proposed ? declaredFields(proposed) : 0, ai_fields_changed: proposed ? changedFields(proposed, specs) : 0,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "No se pudo guardar. Intenta de nuevo." };
  await logConsent(supabase, "process_data");
  revalidatePath("/dashboard");
  redirect(`/revisiones/${data.id}`);
}

// ------------------------------------------------------------------ 4. corrections (Condition 1: claims can be corrected)
export type ReportState = { ok?: boolean; error?: string };
export async function reportAction(_prev: ReportState, fd: FormData): Promise<ReportState> {
  const { supabase } = await requireUser();
  const reqId = typeof fd.get("requirement_id") === "string" ? String(fd.get("requirement_id")) : "";
  if (!CATALOG.some((r) => r.id === reqId)) return { error: "Requisito no válido." };
  const note = text(fd.get("note"), 5, 500);
  if (!note) return { error: "Cuéntanos qué está mal, entre 5 y 500 caracteres." };
  const { error } = await supabase.from("corrections").insert({ requirement_id: reqId, note, catalog_version: CATALOG_VERSION });
  if (error) return { error: "No se pudo enviar el reporte. Intenta de nuevo." };
  revalidatePath("/dashboard");
  return { ok: true };
}

// ------------------------------------------------------------------ 5. deletion ("delete my data")
export async function deleteCheckAction(fd: FormData) {
  const { supabase } = await requireUser();
  const id = uuid(fd.get("check_id"));
  if (id) await supabase.from("checks").delete().eq("id", id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function deleteAllDataAction() {
  const { supabase, user } = await requireUser();
  await supabase.from("checks").delete().eq("user_id", user.id);
  await supabase.from("corrections").delete().eq("user_id", user.id);
  await supabase.from("consents").delete().eq("user_id", user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}
