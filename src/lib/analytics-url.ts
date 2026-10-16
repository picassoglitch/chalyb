// Analytics never sees a URL fragment: Chalito's "Aprobar computadora" link carries a pairing code
// id there (#c=…), and fragments are for the page, not for third parties. Used as Vercel
// Analytics' `beforeSend`.
export const withoutFragment = <E extends { url: string }>(event: E): E => ({
  ...event,
  url: event.url.split('#')[0]!,
});
