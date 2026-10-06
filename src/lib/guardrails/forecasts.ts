// Pronósticos: forecasts only — no betting of any kind (Ley Federal de
// Juegos y Sorteos; BUILD-SPEC §11.5; REVISION-LEGAL A4). Pure.

export const FORECAST_FORBIDDEN =
  /apuesta|apostar|momio|quiniela|concurso|premio|sorteo|rifa|comparte y gana/i;

/** Betting domains that must never be linked from Pronósticos. */
export const BETTING_DOMAIN_DENYLIST = [
  'caliente.mx',
  'codere.mx',
  'betway',
  'bet365',
  'playdoit',
  'strendus',
  'winpot',
  'betano',
];
