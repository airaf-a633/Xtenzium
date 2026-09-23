/**
 * Digital business cards — one per founder, served at /c/<slug>.
 *
 * NFC tags and QR codes point at these URLs, never at the data itself,
 * so a detail can change here without rewriting a single physical card.
 */

export interface Card {
  slug: string;
  first: string;
  /** Leading initial shown before the first name, e.g. "M." */
  initial?: string;
  last: string;
  title: string;
  /** E.164, no spaces — used for tel:, wa.me and the vCard. */
  phone: string;
  /** As printed, for display. */
  phoneDisplay: string;
  email: string;
  linkedin: string;
  personal?: { label: string; url: string };
}

export const ORG = {
  name: 'Xtenzium',
  site: 'https://www.xtenzium.com',
  email: 'contact@xtenzium.com',
  city: 'Karachi',
  country: 'Pakistan',
  tagline: 'We Architect Long-Term Success.',
};

export const cards: Card[] = [
  {
    slug: 'airaf',
    first: 'Airaf',
    last: 'Adil',
    title: 'Senior Partner',
    phone: '+923343365685',
    phoneDisplay: '+92 334 3365685',
    email: 'airafadil619@gmail.com',
    linkedin: 'https://www.linkedin.com/in/muhammad-airaf-adil-b12b33322',
    personal: { label: 'airafadil.vercel.app', url: 'https://airafadil.vercel.app/' },
  },
  {
    slug: 'sharab',
    first: 'Sharab',
    last: 'Khan',
    title: 'Senior Partner',
    phone: '+923303460954',
    phoneDisplay: '+92 330 3460954',
    email: 'sharab.khan101010@gmail.com',
    linkedin: 'https://www.linkedin.com/in/sharab-khan-48118b333',
    personal: { label: 'portfolio-sharab.vercel.app', url: 'https://portfolio-sharab.vercel.app/' },
  },
  {
    slug: 'umar',
    first: 'Umar',
    initial: 'M.',
    last: 'Siddiqui',
    title: 'Senior Partner',
    phone: '+923140302995',
    phoneDisplay: '+92 314 0302995',
    email: 'umarsiddiquifcb@gmail.com',
    linkedin: 'https://www.linkedin.com/in/umar-siddiqui-22b810340',
    personal: { label: 'portfolioumar-xi.vercel.app', url: 'https://portfolioumar-xi.vercel.app/' },
  },
];

export const fullName = (c: Card) => [c.initial, c.first, c.last].filter(Boolean).join(' ');

const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1');

export function vcard(c: Card): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(c.last)};${esc(c.first)};${esc(c.initial ?? '')};;`,
    `FN:${esc(fullName(c))}`,
    `ORG:${ORG.name}`,
    `TITLE:${esc(c.title)}`,
    `TEL;TYPE=CELL,VOICE:${c.phone}`,
    `EMAIL;TYPE=INTERNET,PREF:${c.email}`,
    `EMAIL;TYPE=INTERNET,WORK:${ORG.email}`,
    `URL;TYPE=WORK:${ORG.site}`,
    `item1.URL:${c.linkedin}`,
    'item1.X-ABLabel:LinkedIn',
    ...(c.personal ? [`item2.URL:${c.personal.url}`, 'item2.X-ABLabel:Portfolio'] : []),
    `ADR;TYPE=WORK:;;;${ORG.city};;;${ORG.country}`,
    `NOTE:${esc(`${ORG.name} — software, design and custom hardware. ${ORG.site}`)}`,
    'END:VCARD',
  ];
  return lines.join('\r\n') + '\r\n';
}
