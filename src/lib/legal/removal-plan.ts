// What a copyright removal can do (Uso aceptable §5.2), given what the hub
// can see of the uploader's clip jobs (7a review of #52, HIGH regression).
//
// In production the hub usually can't list jobs (no Clips adapter: the
// card opens the Clips app over SSO). A removal must still go ahead from
// the admin-confirmed source: the video is blocked for re-upload and the
// uploader is notified, and the results already made are removed in the
// Clips engine (the admin is told, and the email says so). When the hub
// does list jobs (adapter in mode a or mock), every match is hidden here
// too. A matching job is never required.

export interface RemovalPlan {
  /** Jobs the hub hides (content_removals). */
  hideJobIds: string[];
  /** The hub could list the uploader's jobs. */
  hubListsJobs: boolean;
  /** Results may exist that only the Clips engine can remove. */
  engineMustRemove: boolean;
}

export function removalPlan(
  jobs: { id: string; fingerprint: string | null }[] | null,
  fingerprint: string,
): RemovalPlan {
  if (jobs === null) return { hideJobIds: [], hubListsJobs: false, engineMustRemove: true };
  const hideJobIds = jobs.filter((j) => j.fingerprint === fingerprint).map((j) => j.id);
  return { hideJobIds, hubListsJobs: true, engineMustRemove: hideJobIds.length === 0 };
}

/** The "what we did" paragraph of the uploader's email: only what happened. */
export function removalDoneText(plan: RemovalPlan): string {
  const hidden = plan.hideJobIds.length;
  const parts = [
    hidden === 1
      ? 'Ocultamos el trabajo de clips hecho con ese video: ya no aparece en Mis resultados ni se puede abrir, descargar ni compartir desde Chalyb.'
      : hidden > 1
        ? `Ocultamos los ${hidden} trabajos de clips hechos con ese video: ya no aparecen en Mis resultados ni se pueden abrir, descargar ni compartir desde Chalyb.`
        : '',
    'Bloqueamos ese video para que no se pueda volver a subir.',
    plan.engineMustRemove
      ? 'Los clips que ya hayas hecho con ese video en la herramienta de Clips también se retiran ahí.'
      : '',
    'Los archivos que ya descargaste o publicaste fuera de Chalyb no los podemos tocar.',
  ];
  return parts.filter(Boolean).join(' ');
}
