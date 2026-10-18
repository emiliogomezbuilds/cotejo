"use client";
import { useActionState, useState } from "react";
import { reportAction, type ReportState } from "@/app/actions";
import { Button } from "@/components/ui/button";

const R0: ReportState = {};

export function ReportButton({ requirementId }: { requirementId: string }) {
  const [open, setOpen] = useState(false);
  const [s, send, pending] = useActionState(reportAction, R0);
  if (s.ok) return <p className="mt-2 text-xs text-green-700">Gracias. Guardamos tu reporte; se revisa y, si procede, se corrige el catálogo.</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs font-medium text-blue-800 hover:underline">
        Reportar un error en este requisito
      </button>
    );
  }
  return (
    <form action={send} className="mt-2 space-y-2">
      <input type="hidden" name="requirement_id" value={requirementId} />
      <label className="block text-xs font-medium">¿Qué está mal o desactualizado?
        <textarea name="note" rows={2} maxLength={500} className="mt-1 block w-full rounded border p-2 text-sm" />
      </label>
      {s.error && <p role="alert" className="text-xs text-red-700">{s.error}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={pending}>{pending ? "Enviando…" : "Enviar reporte"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
