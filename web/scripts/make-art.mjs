/**
 * Generates the site's full-bleed artwork as SVG files.
 *
 * These sections were designed around editorial photography that does not
 * exist yet. Rather than leave them as flat gradients, this produces real
 * image assets from the same routing language as the hero canvas — so the
 * slots are filled with something deliberate, on-brand and consistent.
 *
 * SVG rather than raster on purpose: a few KB instead of a few hundred,
 * resolution-independent, and legible at any crop. The trade is that it is
 * generative geometry, not photography — see the shot list.
 *
 * Everything is seeded, so a given filename always renders identically and
 * the build stays reproducible.
 *
 *   node scripts/make-art.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');

const CARBON = '#0A0908';
const COPPER = '#B8430F';
const COPPER_HI = '#F2895C';

/** Deterministic PRNG so a filename always produces the same image. */
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

/**
 * One routed trace. Segments run orthogonal or at 45° only — the rule a
 * real autorouter follows, and what stops this reading as a scribble.
 */
function route(r, cols, rows, grid, legs) {
  let cx = Math.floor(r() * cols);
  let cy = Math.floor(r() * rows);
  let dir = DIRS[Math.floor(r() * DIRS.length)];
  const pts = [[cx * grid, cy * grid]];

  for (let i = 0; i < legs; i++) {
    const run = 2 + Math.floor(r() * 6);
    cx = Math.max(0, Math.min(cols, cx + dir[0] * run));
    cy = Math.max(0, Math.min(rows, cy + dir[1] * run));
    pts.push([cx * grid, cy * grid]);
    const next = DIRS.filter(
      (d) => !(d[0] === -dir[0] && d[1] === -dir[1]) && !(d[0] === dir[0] && d[1] === dir[1]),
    );
    dir = next[Math.floor(r() * next.length)];
  }
  return pts;
}

const via = (x, y, rad, op) =>
  `<circle cx="${x}" cy="${y}" r="${rad}" fill="${COPPER}" opacity="${op}"/>` +
  `<circle cx="${x}" cy="${y}" r="${(rad * 0.4).toFixed(1)}" fill="${CARBON}"/>`;

/** Dense routing field — for statement panels and page headers. */
function routingField(seed, w, h, opts = {}) {
  const { grid = 40, traces = 46, legs = 7, glowAt = [0.25, 0.4] } = opts;
  const r = rng(seed);
  const cols = Math.ceil(w / grid);
  const rows = Math.ceil(h / grid);
  const parts = [];

  parts.push(`<rect width="${w}" height="${h}" fill="${CARBON}"/>`);

  // Via grid, faint, behind everything.
  parts.push(
    `<pattern id="vg" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">` +
      `<circle cx="${grid / 2}" cy="${grid / 2}" r="1.6" fill="${COPPER}" opacity="0.22"/></pattern>` +
      `<rect width="${w}" height="${h}" fill="url(#vg)"/>`,
  );

  for (let i = 0; i < traces; i++) {
    const pts = route(r, cols, rows, grid, legs);
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
    const strong = r() > 0.72;
    parts.push(
      `<path d="${d}" fill="none" stroke="${strong ? COPPER_HI : COPPER}" ` +
        `stroke-width="${strong ? 2.6 : 1.7}" stroke-opacity="${strong ? 0.55 : 0.32}" ` +
        `stroke-linejoin="round" stroke-linecap="round"/>`,
    );
    parts.push(via(pts[0][0], pts[0][1], 4.2, 0.5));
    parts.push(via(pts[pts.length - 1][0], pts[pts.length - 1][1], 4.2, 0.5));
  }

  // Copper bloom, then a vignette so type stays readable on top.
  parts.push(
    `<radialGradient id="bloom" cx="${glowAt[0]}" cy="${glowAt[1]}" r="0.75">` +
      `<stop offset="0" stop-color="${COPPER}" stop-opacity="0.34"/>` +
      `<stop offset="0.45" stop-color="${COPPER}" stop-opacity="0.1"/>` +
      `<stop offset="1" stop-color="${CARBON}" stop-opacity="0"/></radialGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#bloom)"/>`,
  );
  parts.push(
    `<linearGradient id="vig" x1="0" y1="1" x2="0" y2="0">` +
      `<stop offset="0" stop-color="${CARBON}" stop-opacity="0.92"/>` +
      `<stop offset="0.5" stop-color="${CARBON}" stop-opacity="0.3"/>` +
      `<stop offset="1" stop-color="${CARBON}" stop-opacity="0.7"/></linearGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#vig)"/>`,
  );

  return svg(w, h, parts.join(''));
}

/** Board macro — fewer, heavier traces with pads. For service cards. */
function boardMacro(seed, w, h, hue = COPPER) {
  const r = rng(seed);
  const grid = 56;
  const cols = Math.ceil(w / grid);
  const rows = Math.ceil(h / grid);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];

  // Silkscreen rectangles — the component outlines printed on a board.
  for (let i = 0; i < 5; i++) {
    const x = r() * w * 0.8;
    const y = r() * h * 0.8;
    const bw = 40 + r() * 130;
    const bh = 30 + r() * 90;
    parts.push(
      `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${bw.toFixed(0)}" height="${bh.toFixed(0)}" ` +
        `fill="none" stroke="${COPPER_HI}" stroke-width="1.4" stroke-opacity="0.2" rx="3"/>`,
    );
  }

  for (let i = 0; i < 16; i++) {
    const pts = route(r, cols, rows, grid, 4);
    const d = pts.map((p, j) => `${j ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
    parts.push(
      `<path d="${d}" fill="none" stroke="${hue}" stroke-width="3.4" stroke-opacity="0.42" ` +
        `stroke-linejoin="round" stroke-linecap="round"/>`,
    );
    parts.push(via(pts[0][0], pts[0][1], 6, 0.6));
    parts.push(via(pts[pts.length - 1][0], pts[pts.length - 1][1], 6, 0.6));
  }

  parts.push(
    `<radialGradient id="b" cx="0.3" cy="0.25" r="0.85">` +
      `<stop offset="0" stop-color="${hue}" stop-opacity="0.4"/>` +
      `<stop offset="1" stop-color="${CARBON}" stop-opacity="0"/></radialGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#b)"/>`,
  );
  parts.push(
    `<linearGradient id="v2" x1="0" y1="1" x2="0" y2="0">` +
      `<stop offset="0" stop-color="${CARBON}" stop-opacity="0.9"/>` +
      `<stop offset="0.6" stop-color="${CARBON}" stop-opacity="0.15"/></linearGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#v2)"/>`,
  );
  return svg(w, h, parts.join(''));
}

/** Signal traces — horizontal runs with varying amplitude. */
function signalField(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const lanes = 14;
  for (let i = 0; i < lanes; i++) {
    const y = (h / lanes) * (i + 0.5);
    const amp = 8 + r() * 26;
    const step = 60 + r() * 60;
    let d = `M0,${y.toFixed(1)}`;
    let up = r() > 0.5;
    for (let x = 0; x < w; x += step) {
      const nx = Math.min(w, x + step);
      const ny = up ? y - amp : y + amp;
      d += ` L${(x + step * 0.28).toFixed(1)},${y.toFixed(1)} L${(x + step * 0.42).toFixed(1)},${ny.toFixed(1)} L${(nx - step * 0.14).toFixed(1)},${ny.toFixed(1)} L${nx.toFixed(1)},${y.toFixed(1)}`;
      if (r() > 0.45) up = !up;
    }
    const strong = r() > 0.75;
    parts.push(
      `<path d="${d}" fill="none" stroke="${strong ? COPPER_HI : COPPER}" ` +
        `stroke-width="${strong ? 2.4 : 1.5}" stroke-opacity="${strong ? 0.5 : 0.26}" stroke-linejoin="round"/>`,
    );
  }
  parts.push(
    `<radialGradient id="s" cx="0.5" cy="0.5" r="0.7">` +
      `<stop offset="0" stop-color="${COPPER}" stop-opacity="0.28"/>` +
      `<stop offset="1" stop-color="${CARBON}" stop-opacity="0"/></radialGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#s)"/>`,
  );
  parts.push(
    `<linearGradient id="v3" x1="0" y1="1" x2="0" y2="0">` +
      `<stop offset="0" stop-color="${CARBON}" stop-opacity="0.88"/>` +
      `<stop offset="0.65" stop-color="${CARBON}" stop-opacity="0.2"/></linearGradient>` +
      `<rect width="${w}" height="${h}" fill="url(#v3)"/>`,
  );
  return svg(w, h, parts.join(''));
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"><defs></defs>${body}</svg>`;
}

// ── Manifest ───────────────────────────────────────────────────────
const files = {
  // Statement panels and page headers — wide, dense.
  'statement-duality.svg': routingField(1071, 2400, 1400, { traces: 54, glowAt: [0.22, 0.42] }),
  'statement-template.svg': routingField(4409, 2400, 1400, { traces: 40, glowAt: [0.7, 0.35] }),
  'header-work.svg': routingField(7717, 2400, 900, { traces: 34, grid: 44, glowAt: [0.15, 0.5] }),
  'header-services.svg': signalField(2213, 2400, 900),
  'header-about.svg': routingField(9001, 2400, 900, { traces: 30, grid: 48, glowAt: [0.8, 0.4] }),

  // Service cards — one per line, each visually distinct via seed.
  'service-development.svg': boardMacro(101, 1200, 900),
  'service-design.svg': signalField(202, 1200, 900),
  'service-iot.svg': boardMacro(303, 1200, 900, COPPER_HI),
  'service-automation.svg': routingField(404, 1200, 900, { traces: 26, grid: 34, glowAt: [0.5, 0.3] }),
  'service-consultancy.svg': boardMacro(505, 1200, 900),
  'service-support.svg': signalField(606, 1200, 900),
  'service-marketing.svg': routingField(707, 1200, 900, { traces: 22, grid: 38, glowAt: [0.3, 0.6] }),
};

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content);
  total += Buffer.byteLength(content);
  console.log(`  ${name.padEnd(30)} ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
}
console.log(`\n${Object.keys(files).length} files, ${(total / 1024).toFixed(1)} KB total`);
