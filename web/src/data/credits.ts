/**
 * Earlier client work, credited rather than claimed.
 *
 * Structured data rather than a content collection, for the same reason
 * services.ts is: these are a fixed shape, not prose. None of them has a
 * case study behind it and none of them should pretend to — they get a
 * row, not a page.
 *
 * Why this list is allowed to exist on a site that says "no logo walls":
 *
 * A logo wall shows a mark and lets the reader assume the rest. The
 * assumption it invites — that the agency owned the project — is the part
 * that is usually false, and it is false by omission, which is why it is
 * hard to argue with. Every row here names the contribution instead. A
 * front-end build says front-end build. That is the opposite of a logo
 * wall: it is the sentence a logo wall exists to avoid writing.
 *
 * Nothing in here carries an outcome number, because none of them was
 * measured by us. If a number turns up later it belongs in a case study
 * under content/work, not in this file.
 */

/** The four phrases, fixed. A free string here would drift into five
 *  ways of saying "front-end build" across sixteen rows. */
export type Contribution =
  | 'Front-end build'
  | 'Front-end build with CMS integration'
  | 'Storefront development'
  | 'Full site build';

/** The studios this work shipped under. */
export type Studio =
  | 'Tech Cabin'
  | 'LogoPidea'
  | 'Friends Technologies'
  | 'Bits and digits';

export interface Credit {
  name: string;
  /** What the thing is, in one line. Not a pitch. */
  what: string;
  sector: string;
  stack: string[];
  contribution: Contribution;
  /**
   * The studio it shipped under.
   *
   * TODO(airaf): unassigned. The four studios are known collectively but
   * not per project, and guessing which client belongs to which studio
   * would be inventing attribution — the exact failure this file exists
   * to prevent. Until each row is assigned, the page states the studios
   * collectively instead of per row.
   */
  deliveredUnder?: Studio;
}

export const credits: Credit[] = [
  // ── Healthcare ────────────────────────────────────────────────
  {
    name: 'Doctor On Calls',
    what: 'Telemedicine booking for online consultations.',
    sector: 'Healthcare',
    stack: ['React', 'WordPress', 'PHP'],
    contribution: 'Front-end build',
  },
  {
    name: 'UHC Dubai',
    what: 'Healthcare group site with appointment scheduling.',
    sector: 'Healthcare',
    stack: ['React', 'WordPress', 'PHP'],
    contribution: 'Front-end build',
  },

  // ── Logistics & fleet ─────────────────────────────────────────
  {
    name: 'GoTrack UAE',
    what: 'Fleet tracking and GPS monitoring service.',
    sector: 'Logistics',
    stack: ['WordPress', 'JavaScript', 'MySQL'],
    contribution: 'Front-end build with CMS integration',
  },
  {
    name: 'Alpha Cargo',
    what: 'Logistics and shipment tracking.',
    sector: 'Logistics',
    stack: ['React', 'WordPress', 'PHP'],
    contribution: 'Front-end build with CMS integration',
  },

  // ── Commerce ──────────────────────────────────────────────────
  {
    name: 'Swiss Arabian UAE',
    what: 'Fragrance house storefront.',
    sector: 'E-commerce',
    stack: ['WooCommerce', 'WordPress'],
    contribution: 'Storefront development',
  },
  {
    name: 'Madame Pakistan',
    what: 'Fashion retail storefront.',
    sector: 'E-commerce',
    stack: ['Shopify', 'Liquid'],
    contribution: 'Storefront development',
  },
  {
    name: 'Me Naturals',
    what: 'Skincare storefront.',
    sector: 'E-commerce',
    stack: ['WooCommerce', 'WordPress'],
    contribution: 'Storefront development',
  },

  // ── Hospitality & facilities ──────────────────────────────────
  {
    name: 'Speakeasy UAE',
    what: 'Bar and restaurant site with reservations.',
    sector: 'Hospitality',
    stack: ['WordPress'],
    contribution: 'Front-end build',
  },
  {
    name: 'SGS Cleaning',
    what: 'Facilities services site with online booking.',
    sector: 'Facilities',
    stack: ['WordPress'],
    contribution: 'Front-end build',
  },

  // ── Media & industry ──────────────────────────────────────────
  {
    name: 'Nadia Khan Official',
    what: 'Media personality site with content management.',
    sector: 'Media',
    stack: ['Next.js', 'React', 'CMS'],
    contribution: 'Full site build',
  },
  {
    name: 'Friends Industries',
    what: 'Manufacturing and trading platform.',
    sector: 'Manufacturing',
    stack: ['React', 'Node.js', 'MySQL'],
    contribution: 'Full site build',
  },
  {
    name: 'LIT Co Industries',
    what: 'Industrial manufacturer with a product catalogue.',
    sector: 'Manufacturing',
    stack: ['Next.js', 'TypeScript'],
    contribution: 'Front-end build with CMS integration',
  },

  // ── Studios & platforms ───────────────────────────────────────
  {
    name: 'Davis Interior',
    what: 'Interior design studio portfolio.',
    sector: 'Design',
    stack: ['Next.js', 'Tailwind CSS', 'TypeScript'],
    contribution: 'Front-end build',
  },
  {
    name: 'The Original Creator',
    what: 'Creative agency portfolio platform.',
    sector: 'Design',
    stack: ['Next.js', 'Tailwind CSS', 'TypeScript'],
    contribution: 'Front-end build',
  },
  {
    name: 'Flying Tech',
    what: 'Technology services company site.',
    sector: 'Software',
    stack: ['Next.js', 'Tailwind CSS', 'TypeScript'],
    contribution: 'Front-end build',
  },
  {
    name: 'Crude Oil Capitol',
    what: 'Commodity trading information platform.',
    sector: 'Commodities',
    stack: ['Next.js', 'Node.js', 'TypeScript'],
    contribution: 'Front-end build',
  },
];

/** The studios the above shipped under, stated collectively until each
 *  row can be assigned one. */
export const studios: Studio[] = [
  'Tech Cabin',
  'LogoPidea',
  'Friends Technologies',
  'Bits and digits',
];
