import { Shell } from "@/components/shell";
import { CATALOG, CATALOG_VERSION, SOFTWARE } from "@/lib/catalog";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Evidencia · Cotejo" };

export default function Evidencia() {
  return (
    <Shell>
      <h1 className="text-2xl font-bold">La evidencia detrás de cada resultado</h1>
      <p className="mt-2 text-slate-700">
        Esta es la lista completa de requisitos que Cotejo usa (catálogo v{CATALOG_VERSION}). Cada uno trae las palabras del fabricante, la página de donde salen y la fecha en que se leyó. Si algo está mal o desactualizado, entra y repórtalo desde cualquier resultado.
      </p>
      {SOFTWARE.map((s) => {
        const reqs = CATALOG.filter((r) => r.software === s.id);
        return (
          <section key={s.id} className="mt-8">
            <h2 className="text-xl font-bold">{s.name} <span className="text-sm font-normal text-slate-500">· {s.vendor}</span></h2>
            {(["windows", "macos"] as const).map((pf) => {
              const rows = reqs.filter((r) => r.platform === pf);
              if (rows.length === 0) return (
                <p key={pf} className="mt-2 text-sm text-slate-600">{pf === "windows" ? "Windows" : "macOS"}: no hay evidencia cargada.</p>
              );
              return (
                <div key={pf} className="mt-3">
                  <h3 className="text-sm font-semibold text-slate-700">{pf === "windows" ? "Windows" : "macOS"}</h3>
                  <ul className="mt-1 space-y-2">
                    {rows.map((r) => (
                      <li key={r.id} className="rounded border bg-white p-3 text-sm">
                        <p><span className="font-medium">{r.label}</span> <span className="text-xs text-slate-500">({r.level === "minimum" ? "mínimo" : "recomendado"}) · <span className="font-mono">{r.id}</span></span></p>
                        <p className="mt-1 text-slate-700"><em>“{r.quote}”</em></p>
                        <p className="mt-1 text-xs text-slate-500"><a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-800 underline">Página del fabricante</a> · consultada el {formatDate(r.retrieved)}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </Shell>
  );
}
