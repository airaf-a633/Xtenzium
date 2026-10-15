/**
 * The agency's own contact details, in one place.
 *
 * The email was copy-pasted into ten files before this existed, which
 * meant changing it was a search-and-replace and the structured data was
 * a separate thing to remember. A phone number would have made that
 * eleven, so it goes here instead and everything reads from it.
 *
 * `cards.ts` holds the team's individual numbers for their digital
 * business cards. This is the company line — a different thing, and the
 * two should not be merged: one is a person, one is the agency.
 */

export const org = {
  name: 'Xtenzium',
  url: 'https://www.xtenzium.com',
  email: 'contact@xtenzium.com',

  /**
   * E.164, no spaces or punctuation. This is the form `tel:` and
   * schema.org both want — a human-formatted number in an href works in
   * some dialers and silently fails in others.
   *
   * A US line for a Karachi studio is deliberate: most enquiries come
   * from outside Pakistan, and a local number for the caller removes the
   * international-dial hesitation. The postal address stays PK, because
   * that is where the company actually is and claiming otherwise in
   * structured data is the kind of thing Google checks.
   */
  phone: '+19122006591',
  /** How it is written for a person to read. */
  phoneDisplay: '+1 (912) 200-6591',

  address: {
    locality: 'Karachi',
    region: 'Sindh',
    country: 'PK',
  },
} as const;

/**
 * The schema.org Organization block, built once.
 *
 * Several pages emit an Organization node and they had drifted — the
 * home page carried a logo and a slogan, the contact page did not, and
 * neither had a telephone. Callers spread their own extras over this.
 */
export const organizationLd = {
  '@type': 'Organization',
  name: org.name,
  url: org.url,
  email: org.email,
  telephone: org.phone,
  address: {
    '@type': 'PostalAddress',
    addressLocality: org.address.locality,
    addressRegion: org.address.region,
    addressCountry: org.address.country,
  },
} as const;

/** The sales contact point, for pages that declare one. */
export const contactPointLd = {
  '@type': 'ContactPoint',
  email: org.email,
  telephone: org.phone,
  contactType: 'sales',
  areaServed: 'Worldwide',
  availableLanguage: 'English',
} as const;
