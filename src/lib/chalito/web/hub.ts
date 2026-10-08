/**
 * "Entrar con Chalyb" target. Inside the hub the sign-in happens in place (signInAndReturn drops
 * Chalito's session and HubBridge signs in again), so this is only the link's href: Chalito's own
 * page, never the hub's launch route (/auth/launch/chalito lands on /app/chalito/auth/sso, a 404).
 */
export const hubLaunchUrl = (): string | null => "/app/chalito";
