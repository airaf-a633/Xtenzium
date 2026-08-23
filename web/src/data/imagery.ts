/**
 * Full-bleed imagery.
 *
 * Every slot carries TWO sources:
 *
 *   photo  a real photograph, hotlinked from the Unsplash CDN
 *   art    generated SVG from `scripts/make-art.mjs`, sitting behind it
 *
 * The art is not decoration — it is the fallback ground. It paints first, so
 * if a photo is slow, blocked, or ever 404s, the slot still reads as designed
 * rather than as a black hole. That also means no layout shift: the ground is
 * already the right size before the photo arrives.
 *
 * ── Licence ────────────────────────────────────────────────────────
 * Unsplash photos are free for commercial use and require no attribution.
 * Every URL below was loaded and confirmed to return a 1600px image before
 * being committed; none are guessed.
 *
 * ── Before launch ──────────────────────────────────────────────────
 * These should be downloaded and self-hosted. Hotlinking means a third-party
 * request on every page view, no control if an image is removed, and a
 * dependency on someone else's CDN for your largest contentful paint.
 * Fine for staging; not something to ship.
 *
 * ── Treatment ──────────────────────────────────────────────────────
 * The photographs are generic stock in green, blue and grey. Untreated they
 * look pasted onto the brand. `.duotone` desaturates them and blends copper
 * over the top, so the image keeps its luminance and takes its hue from the
 * palette. That is what makes twelve unrelated photos read as one set.
 */

const CDN = 'https://images.unsplash.com/';
const PARAMS = 'auto=format&fit=crop&q=70';

/** Builds a sized CDN url. Widths are what the slot actually needs. */
function photo(id: string, w: number) {
  return `${CDN}${id}?${PARAMS}&w=${w}`;
}

export interface Imagery {
  photo: string;
  /** Narrower source for small viewports. */
  photoSmall: string;
  art: string;
  alt: string;
}

function slot(id: string, art: string, alt: string, w = 2000): Imagery {
  return { photo: photo(id, w), photoSmall: photo(id, 900), art, alt };
}

/** Wide, dramatic moments — statement panels and page headers. */
export const imagery = {
  statementDuality: slot(
    'photo-1518770660439-4636190af475',
    '/art/statement-duality.svg',
    '',
    2400,
  ),
  statementTemplate: slot(
    'photo-1592659762303-90081d34b277',
    '/art/statement-template.svg',
    '',
    2400,
  ),
  headerWork: slot('photo-1517077304055-6e89abbf09b0', '/art/header-work.svg', ''),
  headerServices: slot('photo-1563770660941-20978e870e26', '/art/header-services.svg', ''),
  headerAbout: slot('photo-1562877773-a37120131ec4', '/art/header-about.svg', ''),
  headerJournal: slot('photo-1517512006864-7edc3b933137', '/art/header-work.svg', ''),
  headerContact: slot('photo-1563770660941-20978e870e26', '/art/header-services.svg', ''),
  headerEstimate: slot('photo-1625838144804-300f3907c110', '/art/header-about.svg', ''),
} satisfies Record<string, Imagery>;

/** One per service line, keyed by slug. */
export const serviceImagery: Record<string, Imagery> = {
  development: slot('photo-1518773553398-650c184e0bb3', '/art/service-development.svg', '', 1400),
  design: slot('photo-1517512006864-7edc3b933137', '/art/service-design.svg', '', 1400),
  iot: slot('photo-1562408590-e32931084e23', '/art/service-iot.svg', '', 1400),
  automation: slot('photo-1625838144804-300f3907c110', '/art/service-automation.svg', '', 1400),
  consultancy: slot('photo-1488590528505-98d2b5aba04b', '/art/service-consultancy.svg', '', 1400),
  marketing: slot('photo-1599837565318-67429bde7162', '/art/service-marketing.svg', '', 1400),
  support: slot('photo-1564940675711-ea4bac5109a5', '/art/service-support.svg', '', 1400),
};

export function serviceImage(slug: string): Imagery {
  return (
    serviceImagery[slug] ?? {
      photo: '',
      photoSmall: '',
      art: '/art/statement-duality.svg',
      alt: '',
    }
  );
}
