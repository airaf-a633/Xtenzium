/**
 * Full-bleed imagery.
 *
 * Generated brand art, one motif per subject. `scripts/make-art.mjs`
 * renders these from the same routing language as the hero canvas —
 * carbon ground, copper geometry, seeded so a filename always produces
 * the same image and the build stays reproducible.
 *
 * ── Why there are no photographs here any more ─────────────────────
 *
 * Every slot used to carry a hotlinked Unsplash photo painted over the
 * art, treated with a copper duotone strong enough to replace the hue
 * outright. Three problems, and they compounded:
 *
 *  - The photographs were generic stock — as the previous version of
 *    this file said in its own comment, "generic stock in green, blue
 *    and grey", which "untreated look pasted onto the brand". The
 *    duotone existed to hide that, and hid the subject along with it.
 *  - An agency whose whole argument is that it builds the board should
 *    not illustrate that claim with a stock photograph of somebody
 *    else's board. Anyone who would be impressed by the claim is
 *    exactly the person who can tell.
 *  - They were hotlinked, which the same comment flagged as "fine for
 *    staging; not something to ship" — a third-party request on every
 *    page view, sitting on the largest contentful paint.
 *
 * The art answers all three. It is on-brand by construction, self-hosted,
 * and 93 KB for the whole set. Photography can come back the day there
 * are real photographs of real work: add `photo` and `photoSmall` to a
 * slot and BleedImage layers it over the art again, with the art as the
 * fallback ground it was always designed to be.
 */

export interface Imagery {
  /** Optional. Absent means the generated art is the whole image. */
  photo?: string;
  /** Narrower source for small viewports. */
  photoSmall?: string;
  art: string;
  alt: string;
}

/**
 * Wide, dramatic moments — statement panels and page headers.
 *
 * The motif is chosen for the subject, never for variety. A routed board
 * sits behind "the software and the board it runs on" because that is
 * literally what the panel is about; the journal gets the typographic
 * motif because a journal is setting and measure.
 */
export const imagery = {
  statementDuality: { art: '/art/statement-duality.svg', alt: '' },
  statementTemplate: { art: '/art/statement-template.svg', alt: '' },
  headerWork: { art: '/art/header-work.svg', alt: '' },
  headerServices: { art: '/art/header-services.svg', alt: '' },
  headerAbout: { art: '/art/header-about.svg', alt: '' },
  headerJournal: { art: '/art/header-journal.svg', alt: '' },
  headerContact: { art: '/art/header-contact.svg', alt: '' },
  headerEstimate: { art: '/art/header-estimate.svg', alt: '' },
} satisfies Record<string, Imagery>;

/**
 * One per service line, keyed by slug.
 *
 *   development  modules on a column grid — interfaces and their parts
 *   design       baseline grid, type masses, one drawn curve
 *   iot          a routed board, the one place electronics is the subject
 *   automation   a directed graph — steps, branches, arrows
 *   consultancy  axes and a plotted climb
 *   marketing    concentric reach from a point
 *   support      signal traces, read as uptime rather than as circuitry
 */
export const serviceImagery: Record<string, Imagery> = {
  development: { art: '/art/service-development.svg', alt: '' },
  design: { art: '/art/service-design.svg', alt: '' },
  iot: { art: '/art/service-iot.svg', alt: '' },
  automation: { art: '/art/service-automation.svg', alt: '' },
  consultancy: { art: '/art/service-consultancy.svg', alt: '' },
  marketing: { art: '/art/service-marketing.svg', alt: '' },
  support: { art: '/art/service-support.svg', alt: '' },
};

export function serviceImage(slug: string): Imagery {
  return serviceImagery[slug] ?? { art: '/art/statement-duality.svg', alt: '' };
}
