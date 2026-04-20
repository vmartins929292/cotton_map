/**
 * Formata duração em minutos para um texto legível em pt-BR.
 *
 * Regras:
 *  - menor que 60 min  -> "45 min"
 *  - menor que 24 h    -> "9h 53min" (omite "0min", ex.: "2h")
 *  - 24 h ou mais      -> "1d 4h"     (omite "0h", ex.: "3d")
 *
 * Valores não finitos ou negativos retornam "—".
 */
export function formatDuration(totalMin: number | null | undefined): string {
  if (totalMin == null || !Number.isFinite(totalMin) || totalMin < 0) return "—";
  const mins = Math.round(totalMin);

  if (mins < 60) return `${mins} min`;

  const totalHours = Math.floor(mins / 60);
  const remMin = mins % 60;

  if (totalHours < 24) {
    return remMin === 0 ? `${totalHours}h` : `${totalHours}h ${remMin}min`;
  }

  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}
