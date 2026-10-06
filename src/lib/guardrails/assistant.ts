// Asistente: always introduces itself as an automatic assistant, never as a
// person (BUILD-SPEC §7.4). Pure.

export function assistantGreeting(businessName: string, locale: string): string {
  const name = businessName.trim() || (locale === 'es' ? 'este negocio' : 'this business');
  return locale === 'es'
    ? `Hola, soy el asistente automático de ${name}.`
    : `Hi, I'm the automatic assistant for ${name}.`;
}

/** Every reply the hub shows starts with the self-identification. */
export function withSelfIdentification(
  reply: string,
  businessName: string,
  locale: string,
): string {
  const greeting = assistantGreeting(businessName, locale);
  return reply.startsWith(greeting) ? reply : `${greeting} ${reply}`;
}
