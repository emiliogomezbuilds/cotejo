import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report-view";
import { CATALOG_VERSION } from "@/lib/catalog";
import { budgetStatus, type CheckReport, type SoftwareReport } from "@/lib/engine";
import { coerceSpecs } from "@/lib/specs";
import { uuid } from "@/lib/validate";
import { formatMx } from "@/lib/format";
import { deleteCheckAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Revision({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireUser();
  const { id } = await params;
  if (!uuid(id)) notFound();
  const { data: c } = await supabase.from("checks").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const specs = coerceSpecs(c.specs as Record<string, unknown>);
  const report: CheckReport = {
    catalogVersion: c.catalog_version,
    budget: budgetStatus(specs.priceMxn, c.budget_mxn),
    reports: c.verdicts as SoftwareReport[],
  };
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-bold">{c.title}</h1>
      <p className="mt-1 text-sm text-slate-600">Guardada el {formatMx(c.created_at)}</p>
      {c.catalog_version !== CATALOG_VERSION && (
        <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
          Esta revisión usó el catálogo v{c.catalog_version}; el catálogo actual es v{CATALOG_VERSION}. Haz una revisión nueva para ver si algo cambió.
        </p>
      )}
      <div className="mt-6"><ReportView report={report} sample={c.is_sample} /></div>
      <form action={deleteCheckAction} className="mt-10 border-t pt-4">
        <input type="hidden" name="check_id" value={c.id} />
        <Button variant="destructive" size="sm">Borrar esta revisión</Button>
      </form>
    </Shell>
  );
}
