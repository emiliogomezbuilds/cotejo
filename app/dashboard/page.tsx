import Link from "next/link";
import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { swName } from "@/lib/catalog";
import { formatMx } from "@/lib/format";
import { deleteAllDataAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { open: "Abierto", fixed: "Corregido", rejected: "No procede" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { supabase, user } = await requireUser();
  const sp = await searchParams;
  const { data: checks } = await supabase.from("checks").select("id,title,software_ids,is_sample,created_at").order("created_at", { ascending: false });
  const { data: reports } = await supabase.from("corrections").select("id,requirement_id,note,status,created_at").order("created_at", { ascending: false });

  return (
    <Shell email={user.email}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tus revisiones</h1>
        <Button asChild><Link href="/revisar">Revisar una laptop</Link></Button>
      </div>
      {sp.deleted && <p className="mt-3 rounded bg-green-50 p-3 text-sm text-green-800">Se borraron todos tus datos.</p>}
      <div className="mt-6 space-y-3">
        {(checks ?? []).length === 0 && <p className="text-slate-600">Aún no tienes revisiones guardadas. Haz una revisión; guardarla es opcional.</p>}
        {(checks ?? []).map((c) => (
          <Link key={c.id} href={`/revisiones/${c.id}`} className="block">
            <Card className="hover:border-blue-700">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="font-medium">{c.title}</p>
                  <p className="text-sm text-slate-600">{(c.software_ids as string[]).map(swName).join(", ")} · {formatMx(c.created_at)}</p>
                </div>
                {c.is_sample && <Badge variant="warning">Simulado</Badge>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {(reports ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Tus reportes de errores</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="rounded border bg-white p-3">
                <p><span className="font-mono text-xs text-slate-500">{r.requirement_id}</span> · <Badge variant={r.status === "open" ? "warning" : r.status === "fixed" ? "success" : "outline"}>{STATUS[r.status] ?? r.status}</Badge></p>
                <p className="mt-1">{r.note}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={deleteAllDataAction} className="mt-10 border-t pt-4">
        <p className="mb-2 text-sm text-slate-600">Borra todas tus revisiones, reportes y permisos. No se puede deshacer.</p>
        <Button variant="destructive" size="sm">Borrar todos mis datos</Button>
      </form>
    </Shell>
  );
}
