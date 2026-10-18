import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <Shell>
      <h1 className="text-3xl font-bold">¿Tu laptop va a correr el software de tu carrera?</h1>
      <p className="mt-3 text-slate-700">
        Escribe los datos de la laptop que estás viendo y Cotejo los compara, uno por uno, con los requisitos que publica el fabricante de AutoCAD, MATLAB, SOLIDWORKS, Adobe Premiere o Visual Studio. Cada resultado trae las palabras del fabricante, el enlace y la fecha en que se leyó.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="lg"><Link href="/login">Empezar con Google</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/evidencia">Ver la evidencia</Link></Button>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["Lo que no sabe, lo dice", "Si un dato falta o no se puede comparar con una regla, aparece como «sin resolver». Nunca se toma como fallo ni como visto bueno."],
          ["Sin tiendas ni comisiones", "No vende, no recomienda laptops y no tiene enlaces de compra. Tú decides."],
          ["Cada dato, con su fuente", "Las reglas salen de las páginas de los fabricantes, no de una IA. Si algo está mal, lo reportas y se corrige."],
        ].map(([t, d]) => (
          <Card key={t}><CardContent className="pt-6"><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-slate-600">{d}</p></CardContent></Card>
        ))}
      </div>
    </Shell>
  );
}
