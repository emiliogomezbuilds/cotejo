import { Badge } from "@/components/ui/badge";
import { ReportButton } from "@/components/report-button";
import { swName } from "@/lib/catalog";
import { COVERAGE_LIMIT, SELF_DECLARED } from "@/lib/wording";
import { platformLabel, type CheckReport, type State } from "@/lib/engine";
import { formatDate } from "@/lib/format";

const STYLE: Record<State, { tag: string; box: string; text: string }> = {
  does_not_meet: { tag: "NO CUMPLE", box: "border-red-600 bg-red-50", text: "text-red-700" },
  cannot_decide: { tag: "SIN RESOLVER", box: "border-slate-400 bg-slate-100", text: "text-slate-700" },
  below_recommended: { tag: "POR DEBAJO DE LO RECOMENDADO", box: "border-amber-500 bg-amber-50", text: "text-amber-800" },
  meets: { tag: "CUMPLE", box: "border-green-600 bg-green-50", text: "text-green-700" },
};

export function ReportView({ report, sample, canReport = true }: { report: CheckReport; sample?: boolean; canReport?: boolean }) {
  const unresolved = report.reports.reduce((n, r) => n + r.counts.cannot_decide, 0);
  return (
    <div className="space-y-6">
      {sample && <Badge variant="warning">Ejemplo · Simulado: laptop inventada</Badge>}
      <p className="text-xs text-slate-500">{SELF_DECLARED}. Cada fuente trae su fecha de consulta · catálogo v{report.catalogVersion}.</p>

      {report.budget.state !== "unknown" && (
        <div className={`rounded border p-3 text-sm ${report.budget.state === "within" ? "border-green-600 bg-green-50 text-green-900" : "border-amber-500 bg-amber-50 text-amber-900"}`}>
          Precio del anuncio ${report.budget.price?.toLocaleString("es-MX")} · tu presupuesto ${report.budget.budget?.toLocaleString("es-MX")}:{" "}
          {report.budget.state === "within" ? "está dentro del presupuesto que tú definiste." : "está por encima del presupuesto que tú definiste. Tú decides qué hacer con eso."}
        </div>
      )}

      <div className="rounded border border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">
        <h2 className="font-semibold">Lo que Cotejo NO revisó</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{COVERAGE_LIMIT}</li>
          {unresolved > 0 && <li>{unresolved} requisito(s) no se pueden decidir con una regla o con los datos que diste; aparecen abajo como «sin resolver», con las palabras del fabricante.</li>}
          {report.reports.filter((r) => r.notChecked.length > 0).map((r) => (
            <li key={r.software}>{swName(r.software)}: {r.notChecked.join("; ")}.</li>
          ))}
        </ul>
      </div>

      {report.reports.length > 0 && (
        <nav aria-label="Resumen por programa" className="rounded border border-slate-300 bg-white p-4 text-sm">
          <h2 className="font-semibold">Resumen por programa</h2>
          <ul className="mt-2 space-y-1">
            {report.reports.map((r) => (
              <li key={r.software}>
                <a href={`#sw-${r.software}`} className="font-medium text-blue-800 underline">{swName(r.software)}</a>
                {r.noEvidence || r.results.length === 0
                  ? <span className="text-slate-600"> · no se pudo revisar</span>
                  : <span className="text-slate-600"> · {r.counts.does_not_meet} no cumple · {r.counts.meets} cumplen · {r.counts.cannot_decide} sin resolver{r.counts.below_recommended > 0 ? ` · ${r.counts.below_recommended} por debajo de lo recomendado` : ""}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-600">
            <strong>Cómo leerlo:</strong> «No cumple» es una regla del fabricante que tus datos no alcanzan. «Sin resolver» quiere decir que Cotejo no puede decidirlo con lo que declaraste: no es un fallo ni un visto bueno. «Por debajo de lo recomendado» es una sugerencia del fabricante, no un requisito. Las citas están en inglés porque así las publica el fabricante. Cotejo no te dice si comprar o no: la decisión es tuya.
          </p>
        </nav>
      )}

      {report.reports.map((r) => (
        <section key={r.software} aria-labelledby={`sw-${r.software}`}>
          <h2 id={`sw-${r.software}`} className="text-xl font-bold">{swName(r.software)}</h2>
          {r.noEvidence || r.results.length === 0 ? (
            <p className="mt-2 rounded border border-slate-400 bg-slate-100 p-3 text-sm">{r.message}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-600">
                {platformLabel(r.platform)} · {r.counts.does_not_meet} no cumple · {r.counts.meets} cumplen · {r.counts.cannot_decide} sin resolver
                {r.counts.below_recommended > 0 ? ` · ${r.counts.below_recommended} por debajo de lo recomendado` : ""}
              </p>
              <ul className="mt-3 space-y-3">
                {r.results.map((x) => {
                  const st = STYLE[x.state];
                  return (
                    <li key={x.reqId} className={`rounded border-l-4 p-3 text-sm ${st.box}`}>
                      <p><span className={`text-xs font-bold ${st.text}`}>{st.tag}</span> <span className="ml-2 font-semibold">{x.label}</span> <span className="text-xs text-slate-500">({x.level === "minimum" ? "mínimo" : "recomendado"})</span></p>
                      <p className="mt-1">{x.detail}</p>
                      {x.caveat && <p className="mt-1 rounded bg-white/70 p-2 text-xs text-amber-900">Ojo: {x.caveat}</p>}
                      <p className="mt-2 text-xs text-slate-600">
                        Fuente (palabras del fabricante): <em>“{x.quote}”</em> ·{" "}
                        <a href={x.url} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">ver página</a> · consultado el {formatDate(x.retrieved)}
                      </p>
                      {canReport && <ReportButton requirementId={x.reqId} />}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
