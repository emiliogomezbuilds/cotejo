import { requireUser } from "@/lib/session";
import { Shell } from "@/components/shell";
import { ReviewFlow } from "./flow";

export const metadata = { title: "Revisar una laptop · Cotejo" };

export default async function Revisar() {
  const { user } = await requireUser();
  return (
    <Shell email={user.email}>
      <h1 className="text-2xl font-bold">Revisar una laptop</h1>
      <p className="mt-1 text-sm text-slate-600">Compara los datos de una laptop con los requisitos que publica el fabricante de tu software.</p>
      <ReviewFlow />
    </Shell>
  );
}
