// One date formatter for every screen, in the owner's timezone (Mexico City), not the
// server's UTC. Live test found evening events shown with tomorrow's date and "a.m.".
export function formatMx(iso: string | Date): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Mexico_City",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // 24h clock: "20:47". "p.m." ends in a period and doubled up with the sentence.
  });
}

/** "2026-10-18" -> "18 de octubre de 2026" without any timezone shifting. */
export function formatDate(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
}
