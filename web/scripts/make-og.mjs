/**
 * Generates the Open Graph card.
 *
 * Every page on the site declares `og:image` and `twitter:image` pointing
 * at /og-image.png, and that file did not exist — so every share of this
 * site on LinkedIn, WhatsApp, Slack or X rendered a blank or broken
 * preview. For a site whose job is client acquisition, that is a silent
 * conversion loss on exactly the link somebody forwards to a colleague.
 *
 * PNG rather than SVG on purpose: the social platforms do not render SVG
 * cards. This composes the card as SVG — same mark, same palette, same
 * routed ground as the rest of the site — and rasterises it with sharp,
 * which Astro already depends on.
 *
 * 1200x630 is the size every platform crops from.
 *
 *   node scripts/make-og.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const W = 1200;
const H = 630;
const CARBON = '#0A0908';
const COPPER = '#B8430F';
const COPPER_HI = '#F2895C';

/** Same deterministic PRNG as make-art.mjs, so the ground matches. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function traces(seed, count) {
  const r = rng(seed);
  const grid = 38;
  const cols = Math.ceil(W / grid);
  const rows = Math.ceil(H / grid);
  const out = [];

  for (let i = 0; i < count; i++) {
    let cx = Math.floor(r() * cols);
    let cy = Math.floor(r() * rows);
    let dir = DIRS[Math.floor(r() * DIRS.length)];
    const pts = [[cx * grid, cy * grid]];

    for (let leg = 0; leg < 6; leg++) {
      const run = 2 + Math.floor(r() * 5);
      cx = Math.max(0, Math.min(cols, cx + dir[0] * run));
      cy = Math.max(0, Math.min(rows, cy + dir[1] * run));
      pts.push([cx * grid, cy * grid]);
      const next = DIRS.filter(
        (d) => !(d[0] === -dir[0] && d[1] === -dir[1]) && !(d[0] === dir[0] && d[1] === dir[1]),
      );
      dir = next[Math.floor(r() * next.length)];
    }

    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
    const strong = r() > 0.75;
    out.push(
      `<path d="${d}" fill="none" stroke="${strong ? COPPER_HI : COPPER}" ` +
        `stroke-width="${strong ? 2.4 : 1.6}" stroke-opacity="${strong ? 0.5 : 0.28}" ` +
        `stroke-linejoin="round" stroke-linecap="round"/>`,
    );
  }
  return out.join('');
}

/**
 * The mark, at 40x40 in its own coordinates, placed and scaled.
 * Same two paths as components/Logo.astro — the right half is the left
 * half rotated 180°, which is what puts the dark panels on the diagonal.
 */
function mark(x, y, size) {
  const s = size / 40;
  const LIGHT = 'M6,24 L19.5,15 L19.5,27 L6,36 Z';
  const DARK = 'M6,4 L19.5,13 L19.5,25 L6,16 Z';
  return (
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="${LIGHT}" fill="${COPPER_HI}"/>` +
    `<path d="${LIGHT}" fill="${COPPER_HI}" transform="rotate(180 20 20)"/>` +
    `<path d="${DARK}" fill="${COPPER}"/>` +
    `<path d="${DARK}" fill="${COPPER}" transform="rotate(180 20 20)"/>` +
    `</g>`
  );
}

/**
 * Text is drawn with a generic family stack rather than the brand
 * typeface. Bricolage Grotesque is a webfont and the rasteriser only sees
 * fonts installed on the machine running this script, so naming it would
 * produce a card that renders correctly for whoever happens to have it
 * and silently substitutes for everybody else. A predictable heavy
 * grotesque is the honest choice for an asset that must look identical
 * everywhere it is generated.
 */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${CARBON}"/>
  ${traces(4242, 30)}

  <radialGradient id="bloom" cx="0.22" cy="0.35" r="0.8">
    <stop offset="0" stop-color="${COPPER}" stop-opacity="0.4"/>
    <stop offset="1" stop-color="${CARBON}" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#bloom)"/>

  <linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${CARBON}" stop-opacity="0.92"/>
    <stop offset="0.72" stop-color="${CARBON}" stop-opacity="0.55"/>
    <stop offset="1" stop-color="${CARBON}" stop-opacity="0.2"/>
  </linearGradient>
  <rect width="${W}" height="${H}" fill="url(#scrim)"/>

  ${mark(84, 74, 58)}
  <text x="156" y="118" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="38" font-weight="700" fill="#FFFFFF" letter-spacing="-0.5">Xtenzium</text>

  <text x="84" y="330" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="82" font-weight="700" fill="#FFFFFF" letter-spacing="-3">We architect</text>
  <text x="84" y="418" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="82" font-weight="700" fill="${COPPER_HI}" letter-spacing="-3">long-term success.</text>

  <rect x="84" y="470" width="72" height="4" rx="2" fill="${COPPER}"/>

  <text x="84" y="536" font-family="Segoe UI, Arial, Helvetica, sans-serif"
        font-size="27" font-weight="400" fill="#FFFFFF" opacity="0.62">Software, hardware, and the systems that connect them.</text>
  <text x="84" y="576" font-family="Consolas, Menlo, monospace"
        font-size="19" fill="${COPPER_HI}" opacity="0.85" letter-spacing="2">KARACHI, PAKISTAN</text>
</svg>`;

mkdirSync(OUT, { recursive: true });

const file = join(OUT, 'og-image.png');
await sharp(Buffer.from(svg)).png({ quality: 90 }).toFile(file);

const { size } = await import('node:fs').then((fs) => fs.promises.stat(file));
console.log(`  og-image.png  ${W}x${H}  ${(size / 1024).toFixed(1)} KB`);
