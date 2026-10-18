import { Shell } from "@/components/shell";
import { COVERAGE_LIMIT, DECISION_IS_YOURS } from "@/lib/wording";

export const metadata = { title: "Privacidad · Cotejo" };

export default function Privacidad() {
  return (
    <Shell>
      <h1 className="text-2xl font-bold">Qué guardamos y qué no</h1>
      <div className="mt-4 space-y-4 text-slate-800">
        <p><strong>Guardamos</strong> solo si tú lo pides: los datos de la laptop que declaraste, tu presupuesto, los resultados y la versión del catálogo con la que se calcularon, además de tus permisos y los reportes de error que envíes.</p>
        <p><strong>No guardamos</strong> capturas de pantalla, el texto que escribes para la ayuda con IA, tu correo más allá de lo que Google nos da para iniciar sesión, ni tu IP o navegador.</p>
        <p><strong>Ayuda con IA (opcional):</strong> si la usas, tu texto o tu captura se envían a la API gratuita de Gemini de Google solo para proponer valores. La capa gratuita puede usar el contenido para mejorar sus productos; por eso está apagada por defecto y pide tu permiso cada vez. La IA nunca decide un resultado: tú confirmas cada campo y los resultados los calcula código que sigue reglas fijas y cita su fuente. Hay un límite diario de usos para cuidar la cuenta gratuita.</p>
        <p><strong>Sin vendedores:</strong> Cotejo no tiene enlaces de compra, no cobra comisiones y no comparte datos con tiendas. Hoy funciona con servicios gratuitos, así que cuesta 0 pesos operar, aunque mantener el catálogo al día lleva trabajo manual.</p>
        <p><strong>Borrar:</strong> desde tu panel puedes borrar una revisión o todos tus datos cuando quieras.</p>
        <p><strong>Límites:</strong> {COVERAGE_LIMIT} {DECISION_IS_YOURS}</p>
      </div>
    </Shell>
  );
}
