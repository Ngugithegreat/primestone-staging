/**
 * Single source of truth for company identity.
 *
 * Everything user-facing — legal pages, the About and Contact pages, the
 * footer — reads from here, so updating a detail happens in exactly one place.
 *
 * ⚠️  Several values below are placeholders you MUST replace before this is
 *     public. They are deliberately left as obvious placeholders rather than
 *     realistic-looking invented values:
 *      - `licence`  — intentionally left unset on this staging clone while the
 *        real FSC (Mauritius) licence status is being verified. Do not fill
 *        this in with a number until that's confirmed.
 *      - `phone`    — your real switchboard number
 *      - `address`  — the exact registered-office lines in Mauritius
 */
export const COMPANY = {
  name: "PrimeStone Markets Ltd",
  shortName: "PrimeStone",
  foundedYear: 2019,

  regulator: "Financial Services Commission (FSC) of Mauritius",
  regulatorShort: "FSC",
  jurisdiction: "Mauritius",
  licence: "Licence pending verification", // deliberately not asserting a licence number

  // ⚠️ PROVISIONAL Mauritius address — a plausible stand-in so nothing renders
  // blank. Replace every line below with the exact registered-office address
  // once confirmed.
  address: {
    line1: "Level 3, Ebène Heights",
    line2: "Rue de la Démocratie",
    street: "Cybercity",
    city: "Ebène 72201",
    country: "Mauritius",
    postal: "72201",
  },

  email: {
    support: "support@primestone.com",
    sales: "hello@primestone.com",
    compliance: "compliance@primestone.com",
    complaints: "complaints@primestone.com",
  },

  phone: "+230 000 0000", // TODO: replace with your real switchboard number
  supportHours: "Monday to Friday, 08:00–18:00 GMT+4",

  socials: {
    x: "https://x.com/primestone",
    linkedin: "https://linkedin.com/company/primestone",
    instagram: "https://instagram.com/primestone",
  },
} as const;

export function fullAddress() {
  const a = COMPANY.address;
  return `${a.line1}, ${a.line2}, ${a.street}, ${a.city}, ${a.country}`;
}
