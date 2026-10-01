// Quebec (BUILD-SPEC §11.8, D2/Q2). Until the owner picks Option A (French
// documents + special clauses), paid plans are blocked for Quebec residents.
// Pure.

export function quebecPaidBlock(): boolean {
  const raw = process.env.QUEBEC_PAID_BLOCK;
  return raw === undefined || raw === '' ? true : raw === '1' || raw.toLowerCase() === 'true';
}

/** Whether what we know about the payer places them in Quebec: the card or
 *  billing address province from Mercado Pago, or what they declared. */
export function isQuebec(input: {
  country?: string | null;
  province?: string | null;
  declared?: string | null;
}): boolean {
  const norm = (s?: string | null) =>
    (s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (['qc', 'quebec', 'ca-qc'].includes(norm(input.declared))) return true;
  const country = norm(input.country);
  const province = norm(input.province);
  return (
    (country === '' || country === 'ca' || country === 'canada') &&
    ['qc', 'quebec', 'ca-qc'].includes(province)
  );
}

export function paidPlansBlocked(
  input: Parameters<typeof isQuebec>[0],
  block = quebecPaidBlock(),
): boolean {
  return block && isQuebec(input);
}
