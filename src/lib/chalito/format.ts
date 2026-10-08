/**
 * Number and date formatting for Chalito's screens, following the hub's convention (es → es-MX,
 * en → en-US; see src/lib/payments/pack-consent.ts). Plain "es" groups only from five digits and
 * with a dot ("1000", "10.000"), so token amounts on one screen looked inconsistent.
 */
export const intlLocale = (locale: string): string => (locale === "es" ? "es-MX" : "en-US");

/** A token amount: "1,000", "10,000". */
export const tokenFormat = (locale: string): Intl.NumberFormat => new Intl.NumberFormat(intlLocale(locale));
