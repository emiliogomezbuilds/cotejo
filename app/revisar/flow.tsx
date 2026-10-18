"use client";
import { useActionState, useState, useTransition } from "react";
import { checkAction, intakeAction, saveCheckAction, visionAction, type CheckState, type SaveState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReportView } from "@/components/report-view";
import { SOFTWARE, type SoftwareId } from "@/lib/catalog";
import { ARCH_LABEL, OS_LABEL, OS_KEYS, ARCHS, mergeSpecs, type Specs } from "@/lib/specs";
import { SELF_DECLARED } from "@/lib/wording";

const C0: CheckState = {};
const S0: SaveState = {};

type Fields = { os: string; win11_24h2: string; macVersion: string; arch: string; ramGb: string; storageGb: string; gpuKind: string; vramGb: string; priceMxn: string };
const BLANK: Fields = { os: "unknown", win11_24h2: "unknown", macVersion: "", arch: "unknown", ramGb: "", storageGb: "", gpuKind: "unknown", vramGb: "", priceMxn: "" };
const SAMPLE: Fields = { os: "win11_home", win11_24h2: "unknown", macVersion: "", arch: "x86_64", ramGb: "16", storageGb: "512", gpuKind: "integrated", vramGb: "", priceMxn: "17499" };

const toFields = (s: Specs): Fields => ({
  os: s.os, win11_24h2: s.win11_24h2, macVersion: s.macVersion === null ? "" : String(s.macVersion), arch: s.arch,
  ramGb: s.ramGb === null ? "" : String(s.ramGb), storageGb: s.storageGb === null ? "" : String(s.storageGb),
  gpuKind: s.gpuKind, vramGb: s.vramGb === null ? "" : String(s.vramGb), priceMxn: s.priceMxn === null ? "" : String(s.priceMxn),
});
const filled = (k: keyof Fields, v: string) => (k === "os" || k === "arch" || k === "gpuKind" || k === "win11_24h2" ? v !== "unknown" : v !== "");

export function ReviewFlow() {
  const [check, runCheck, checking] = useActionState(checkAction, C0);
  const [saved, save, saving] = useActionState(saveCheckAction, S0);
  const [sw, setSw] = useState<SoftwareId[]>([]);
  const [budget, setBudget] = useState("");
  const [f, setF] = useState<Fields>(BLANK);
  const [aiMarked, setAiMarked] = useState<Set<keyof Fields>>(new Set());
  const [proposed, setProposed] = useState<Specs | null>(null);
  const [usedText, setUsedText] = useState(false);
  const [usedImage, setUsedImage] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [helperMsg, setHelperMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showResult, setShowResult] = useState(true);

  const set = (k: keyof Fields, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setAiMarked((p) => { const n = new Set(p); n.delete(k); return n; }); // editing a proposed field means she reviewed it
  };
  const toggleSw = (id: SoftwareId) => setSw((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function applyProposal(specs: Specs, software?: SoftwareId[], budgetMxn?: number | null) {
    const next = toFields(specs);
    setF((p) => ({ ...p, ...Object.fromEntries((Object.keys(next) as (keyof Fields)[]).filter((k) => filled(k, next[k])).map((k) => [k, next[k]])) }));
    setAiMarked((p) => new Set([...p, ...(Object.keys(next) as (keyof Fields)[]).filter((k) => filled(k, next[k]))]));
    setProposed((prev) => (prev ? mergeSpecs(prev, specs) : specs));
    if (software && software.length) setSw((p) => [...new Set([...p, ...software])]);
    if (budgetMxn) setBudget(String(budgetMxn));
    setShowResult(false);
  }

  function runIntake(fd: FormData) {
    setHelperMsg(null);
    startTransition(async () => {
      const r = await intakeAction(fd);
      if (r.error) setHelperMsg(r.error);
      else if (r.proposal) { applyProposal(r.proposal.specs, r.proposal.software, r.proposal.budgetMxn); setUsedText(true); setHelperMsg("Listo: llenamos lo que dijiste. Revisa cada campo marcado."); }
    });
  }
  function runVision(fd: FormData) {
    setHelperMsg(null);
    startTransition(async () => {
      const r = await visionAction(fd);
      if (r.error) setHelperMsg(r.error);
      else if (r.proposal) { applyProposal(r.proposal.specs); setUsedImage(true); setHelperMsg("Listo: propusimos los datos que se ven en la captura. Revisa cada campo marcado."); }
    });
  }
  function loadSample() {
    setSw(["solidworks", "autocad"]); setBudget("18000"); setF(SAMPLE); setAiMarked(new Set()); setProposed(null);
    setUsedText(false); setUsedImage(false); setIsSample(true); setShowResult(false); setHelperMsg("Cargamos una laptop inventada. Puedes cambiar cualquier dato.");
  }

  const mark = (k: keyof Fields) => (aiMarked.has(k) ? "border-purple-500 bg-purple-50" : "");
  const aiBadge = (k: keyof Fields) => (aiMarked.has(k) ? <Badge variant="outline" className="ml-2 border-purple-500 text-purple-700">Propuesto por IA: confirma</Badge> : null);
  const hasAiMarks = aiMarked.size > 0;

  const result = check.result;
  if (result && showResult) {
    return (
      <div className="mt-4 space-y-6">
        <ReportView report={result.report} sample={result.isSample} />
        <form action={save} className="space-y-3 rounded border bg-white p-4">
          <h2 className="font-semibold">¿Quieres guardar esta revisión?</h2>
          <p className="text-sm text-slate-600">Es opcional. Guardamos tus datos declarados y los resultados, ligados a la versión del catálogo. No guardamos capturas ni el texto que escribiste.</p>
          {saved.error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{saved.error}</p>}
          <label className="block text-sm font-medium">Título (opcional)
            <input name="title" maxLength={80} placeholder="Si lo dejas vacío, lo nombramos por el programa" className="mt-1 block w-full rounded border p-2" />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent_process" className="mt-1" />
            <span>Permito que Cotejo guarde esta revisión en mi cuenta. Puedo borrarla cuando quiera.</span>
          </label>
          {result.software.map((id) => <input key={id} type="hidden" name="software" value={id} />)}
          <input type="hidden" name="budgetMxn" value={result.budgetMxn ?? ""} />
          {Object.entries(toFields(result.specs)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {result.proposed && <input type="hidden" name="ai_proposed" value={JSON.stringify(result.proposed)} />}
          <input type="hidden" name="used_text" value={result.usedText ? "1" : "0"} />
          <input type="hidden" name="used_image" value={result.usedImage ? "1" : "0"} />
          <input type="hidden" name="is_sample" value={result.isSample ? "1" : "0"} />
          <div className="flex gap-3">
            <Button disabled={saving}>{saving ? "Guardando…" : "Guardar revisión"}</Button>
            <Button type="button" variant="outline" onClick={() => setShowResult(false)}>Cambiar datos</Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <form action={(fd) => { setShowResult(true); runCheck(fd); }} className="mt-4 space-y-6">
      <ol className="list-decimal space-y-1 rounded bg-blue-50 p-3 pl-8 text-sm text-slate-800">
        <li><strong>Elige</strong> los programas que necesitas y tu presupuesto.</li>
        <li><strong>Escribe</strong> los datos de la laptop que estás viendo (o sube una captura del anuncio y confirma lo que se lea).</li>
        <li><strong>Revisa:</strong> verás cada requisito del fabricante, con su fuente. Lo que no sepas queda como «sin resolver», no como fallo.</li>
      </ol>
      {check.error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{check.error}</p>}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">1. Programas que necesitas</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SOFTWARE.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded border bg-white p-2 text-sm">
              <input type="checkbox" name="software" value={s.id} checked={sw.includes(s.id)} onChange={() => toggleSw(s.id)} />
              <span>{s.name} <span className="text-xs text-slate-500">({s.vendor})</span></span>
            </label>
          ))}
        </div>
        <label className="block text-sm font-medium">Tu presupuesto en pesos (opcional)
          <input name="budgetMxn" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="18000" className="mt-1 block w-full rounded border p-2" />
        </label>
      </fieldset>

      <fieldset className="space-y-3 rounded border bg-white p-3">
        <legend className="px-1 text-sm font-semibold">2. Datos de la laptop <span className="font-normal text-slate-500">· {SELF_DECLARED}</span></legend>
        <p className="text-xs text-slate-500">Si no sabes un dato, déjalo en «No lo sé»: Cotejo no lo trata como fallo. Casi todo viene en la ficha del anuncio.</p>

        <label className="block text-sm font-medium">Sistema operativo{aiBadge("os")}
          <select name="os" value={f.os} onChange={(e) => set("os", e.target.value)} className={`mt-1 block w-full rounded border p-2 ${mark("os")}`}>
            {OS_KEYS.map((k) => <option key={k} value={k}>{OS_LABEL[k]}</option>)}
          </select>
        </label>
        {(f.os === "win11_home" || f.os === "win11_pro") && (
          <label className="block text-sm font-medium">¿Tiene la actualización 24H2 de Windows 11 (o más nueva)?{aiBadge("win11_24h2")}
            <select name="win11_24h2" value={f.win11_24h2} onChange={(e) => set("win11_24h2", e.target.value)} className={`mt-1 block w-full rounded border p-2 ${mark("win11_24h2")}`}>
              <option value="unknown">No lo sé</option><option value="yes">Sí</option><option value="no">No</option>
            </select>
            <span className="text-xs font-normal text-slate-500">Una laptop nueva puede traer una versión anterior. Se ve en Configuración, Sistema, Acerca de.</span>
          </label>
        )}
        {f.os === "macos" && (
          <label className="block text-sm font-medium">Versión de macOS (número, por ejemplo 14, 15 o 26){aiBadge("macVersion")}
            <input name="macVersion" inputMode="numeric" value={f.macVersion} onChange={(e) => set("macVersion", e.target.value)} className={`mt-1 block w-full rounded border p-2 ${mark("macVersion")}`} />
          </label>
        )}
        <label className="block text-sm font-medium">Tipo de procesador{aiBadge("arch")}
          <select name="arch" value={f.arch} onChange={(e) => set("arch", e.target.value)} className={`mt-1 block w-full rounded border p-2 ${mark("arch")}`}>
            {ARCHS.map((k) => <option key={k} value={k}>{ARCH_LABEL[k]}</option>)}
          </select>
          <span className="text-xs font-normal text-slate-500">Intel Core y AMD Ryzen son «Intel o AMD». Snapdragon y los chips Apple M son «ARM».</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">Memoria RAM (GB){aiBadge("ramGb")}
            <input name="ramGb" inputMode="decimal" value={f.ramGb} onChange={(e) => set("ramGb", e.target.value)} placeholder="16" className={`mt-1 block w-full rounded border p-2 ${mark("ramGb")}`} />
          </label>
          <label className="block text-sm font-medium">Almacenamiento total (GB; 1 TB = 1000){aiBadge("storageGb")}
            <input name="storageGb" inputMode="decimal" value={f.storageGb} onChange={(e) => set("storageGb", e.target.value)} placeholder="512" className={`mt-1 block w-full rounded border p-2 ${mark("storageGb")}`} />
          </label>
        </div>
        <label className="block text-sm font-medium">Gráficos{aiBadge("gpuKind")}
          <select name="gpuKind" value={f.gpuKind} onChange={(e) => set("gpuKind", e.target.value)} className={`mt-1 block w-full rounded border p-2 ${mark("gpuKind")}`}>
            <option value="unknown">No lo sé</option><option value="integrated">Integrados (vienen dentro del procesador)</option><option value="dedicated">Tarjeta dedicada (por ejemplo NVIDIA GeForce o AMD Radeon)</option>
          </select>
        </label>
        {f.gpuKind === "dedicated" && (
          <label className="block text-sm font-medium">Memoria de la tarjeta dedicada (GB){aiBadge("vramGb")}
            <input name="vramGb" inputMode="decimal" value={f.vramGb} onChange={(e) => set("vramGb", e.target.value)} placeholder="4" className={`mt-1 block w-full rounded border p-2 ${mark("vramGb")}`} />
          </label>
        )}
        <label className="block text-sm font-medium">Precio del anuncio en pesos (opcional){aiBadge("priceMxn")}
          <input name="priceMxn" inputMode="numeric" value={f.priceMxn} onChange={(e) => set("priceMxn", e.target.value)} placeholder="17499" className={`mt-1 block w-full rounded border p-2 ${mark("priceMxn")}`} />
        </label>
      </fieldset>

      <details className="rounded border bg-white p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Opcional: que una IA te ayude a llenar los datos</summary>
        <p className="mt-2 text-xs text-slate-600">La IA solo propone valores. Tú confirmas cada uno y la revisión funciona igual sin ella. La capa gratuita de Google (Gemini) puede usar lo que envías para mejorar sus productos; Cotejo no guarda ni el texto ni la imagen.</p>
        {helperMsg && <p role="status" className="mt-2 rounded bg-slate-100 p-2 text-xs">{helperMsg}</p>}
        <div className="mt-3 space-y-2">
          <label className="block font-medium">Cuéntanos tu situación en tus palabras
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={3} maxLength={1500} placeholder="Estudio ingeniería civil, necesito AutoCAD y SolidWorks. Tengo 18 mil pesos y vi una laptop con Windows 11 Home, 16 GB de RAM y 512 GB." className="mt-1 block w-full rounded border p-2" />
          </label>
          <label className="flex items-start gap-2 text-xs"><input id="ct" type="checkbox" className="mt-0.5" /><span>Permito enviar este texto a la IA de Google para proponer los campos.</span></label>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => {
            const fd = new FormData(); fd.set("free_text", freeText); if ((document.getElementById("ct") as HTMLInputElement)?.checked) fd.set("consent_ai_text", "on"); runIntake(fd);
          }}>{pending ? "Leyendo…" : "Proponer campos con mi texto"}</Button>
        </div>
        <div className="mt-4 space-y-2 border-t pt-3">
          <label className="block font-medium">O sube una captura del anuncio (PNG, JPG o WebP, máx. 4 MB)
            <input id="img" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block text-sm" />
          </label>
          <label className="flex items-start gap-2 text-xs"><input id="ci" type="checkbox" className="mt-0.5" /><span>Permito enviar esta imagen a la IA de Google para leer los datos. No se guarda.</span></label>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => {
            const fd = new FormData(); const file = (document.getElementById("img") as HTMLInputElement)?.files?.[0]; if (file) fd.set("image", file);
            if ((document.getElementById("ci") as HTMLInputElement)?.checked) fd.set("consent_ai_image", "on"); runVision(fd);
          }}>{pending ? "Leyendo…" : "Leer captura"}</Button>
        </div>
      </details>

      {hasAiMarks && (
        <label className="flex items-start gap-2 rounded border border-purple-500 bg-purple-50 p-3 text-sm">
          <input type="checkbox" name="confirm_ai" className="mt-1" />
          <span>Revisé cada campo marcado como «propuesto por IA» y estos son los datos que quiero usar.</span>
        </label>
      )}
      {proposed && !hasAiMarks && <input type="hidden" name="confirm_ai" value="on" />}
      {proposed && <input type="hidden" name="ai_proposed" value={JSON.stringify(proposed)} />}
      <input type="hidden" name="used_text" value={usedText ? "1" : "0"} />
      <input type="hidden" name="used_image" value={usedImage ? "1" : "0"} />
      <input type="hidden" name="is_sample" value={isSample ? "1" : "0"} />

      <div className="flex flex-wrap gap-3">
        <Button disabled={checking}>{checking ? "Revisando…" : "Revisar"}</Button>
        <Button type="button" variant="outline" onClick={loadSample}>Probar con una laptop inventada</Button>
      </div>
    </form>
  );
}
