// "Quién vende" (art. 76 Bis fr. III LFPC; rebuild P2-13). The seller's
// identity comes from LEGAL_ENTITY_* (values are OPS-10). Pure.

export interface LegalEntity {
  name: string;
  rfc: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  complaints: string;
}

const FIELDS: Record<keyof LegalEntity, string> = {
  name: 'LEGAL_ENTITY_NAME',
  rfc: 'LEGAL_ENTITY_RFC',
  address: 'LEGAL_ENTITY_ADDRESS',
  phone: 'LEGAL_ENTITY_PHONE',
  email: 'LEGAL_ENTITY_EMAIL',
  hours: 'LEGAL_ENTITY_HOURS',
  complaints: 'LEGAL_ENTITY_COMPLAINTS',
};

export function legalEntity(): LegalEntity {
  return Object.fromEntries(
    Object.entries(FIELDS).map(([k, env]) => [k, (process.env[env] ?? '').trim()]),
  ) as unknown as LegalEntity;
}

export function missingLegalEntityFields(e = legalEntity()): string[] {
  return (Object.keys(FIELDS) as (keyof LegalEntity)[]).filter((k) => !e[k]).map((k) => FIELDS[k]);
}
