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

/**
 * ── Subject motifs ─────────────────────────────────────────────────
 *
 * The three motifs above are all electronics, which is right for one
 * service and wrong for the other six: the design page was illustrated
 * with signal waveforms and the marketing page with circuit traces.
 * Art that has nothing to do with the page it sits behind is decoration,
 * and decoration is what you use when you have not decided what the
 * section is about.
 *
 * These share the language — carbon ground, copper geometry, seeded so a
 * filename always renders identically — and differ in what they draw.
 */

/**
 * Closes every motif the same way: a copper bloom for depth, then a
 * vignette so type stays readable over the top.
 *
 * The vignette is doing two jobs that pull against each other — protect
 * the type, and let the drawing be seen. It was weighted almost entirely
 * to the first, at 0.9 over the lower half and 0.18 still sitting across
 * the middle, which left the motif barely legible behind a heading.
 *
 * The fix is not simply less vignette. Type sits low-left in every one of
 * these slots, so the mask is now steeper rather than lighter: it holds
 * its weight exactly where the words are and clears quickly above them,
 * which buys the drawing back without touching contrast where it counts.
 */
function finish(w, h, hue, at = [0.3, 0.35]) {
  return (
    `<radialGradient id="bl" cx="${at[0]}" cy="${at[1]}" r="0.8">` +
    `<stop offset="0" stop-color="${hue}" stop-opacity="0.42"/>` +
    `<stop offset="1" stop-color="${CARBON}" stop-opacity="0"/></radialGradient>` +
    `<rect width="${w}" height="${h}" fill="url(#bl)"/>` +
    `<linearGradient id="vg2" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${CARBON}" stop-opacity="0.88"/>` +
    `<stop offset="0.34" stop-color="${CARBON}" stop-opacity="0.34"/>` +
    `<stop offset="0.72" stop-color="${CARBON}" stop-opacity="0"/></linearGradient>` +
    `<rect width="${w}" height="${h}" fill="url(#vg2)"/>`
  );
}

/** Nested modules on a column grid — interfaces and the components they
 *  are assembled from. For web development and the work index. */
function moduleGrid(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const col = w / 12;

  for (let i = 1; i < 12; i++) {
    parts.push(
      `<line x1="${(col * i).toFixed(0)}" y1="0" x2="${(col * i).toFixed(0)}" y2="${h}" ` +
        `stroke="${COPPER}" stroke-width="1" stroke-opacity="0.16"/>`,
    );
  }

  for (let i = 0; i < 22; i++) {
    const span = 1 + Math.floor(r() * 4);
    const x = Math.floor(r() * (12 - span)) * col;
    const y = r() * h * 0.86;
    const bh = 40 + r() * 150;
    const lead = r() > 0.72;
    parts.push(
      `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(col * span).toFixed(0)}" height="${bh.toFixed(0)}" ` +
        `rx="8" fill="none" stroke="${lead ? COPPER_HI : COPPER}" stroke-width="${lead ? 2.2 : 1.4}" ` +
        `stroke-opacity="${lead ? 0.45 : 0.22}"/>`,
    );
    if (lead) {
      parts.push(
        `<rect x="${(x + 12).toFixed(0)}" y="${(y + 12).toFixed(0)}" width="${(col * span - 24).toFixed(0)}" ` +
          `height="6" rx="3" fill="${COPPER_HI}" opacity="0.43"/>`,
      );
    }
  }
  parts.push(finish(w, h, COPPER, [0.2, 0.3]));
  return svg(w, h, parts.join(''));
}

/** Baseline grid, type masses and one drawn curve — the tools of layout
 *  rather than a picture of a designer. For design and branding. */
function typeGrid(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const base = 34;

  for (let y = base; y < h; y += base) {
    parts.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${COPPER}" ` +
        `stroke-width="1" stroke-opacity="0.11"/>`,
    );
  }

  // Blocks of setting: a heading mass, then measures of body beneath it.
  let y = h * 0.16;
  for (let b = 0; b < 5; b++) {
    const x = w * (0.06 + r() * 0.42);
    const lines = 2 + Math.floor(r() * 5);
    const measure = w * (0.16 + r() * 0.3);
    parts.push(
      `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(measure * 0.62).toFixed(0)}" ` +
        `height="${(base * 0.7).toFixed(0)}" fill="${COPPER_HI}" opacity="0.49"/>`,
    );
    for (let l = 0; l < lines; l++) {
      const ly = y + base * (l + 1.5);
      parts.push(
        `<rect x="${x.toFixed(0)}" y="${ly.toFixed(0)}" width="${(measure * (0.5 + r() * 0.5)).toFixed(0)}" ` +
          `height="5" rx="2.5" fill="${COPPER}" opacity="0.29"/>`,
      );
    }
    y += base * (lines + 3.2);
    if (y > h * 0.82) y = h * 0.12;
  }

  // A single curve — the one gesture that is not on the grid.
  parts.push(
    `<path d="M0,${(h * 0.78).toFixed(0)} C${(w * 0.3).toFixed(0)},${(h * 0.4).toFixed(0)} ` +
      `${(w * 0.62).toFixed(0)},${(h * 0.95).toFixed(0)} ${w},${(h * 0.5).toFixed(0)}" ` +
      `fill="none" stroke="${COPPER_HI}" stroke-width="2.4" stroke-opacity="0.62"/>`,
  );
  parts.push(finish(w, h, COPPER, [0.72, 0.3]));
  return svg(w, h, parts.join(''));
}

/** A directed graph — steps, branches and the arrows between them. For
 *  AI and automation. */
function nodeGraph(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const colCount = 5;
  const colW = w / (colCount + 1);
  const nodes = [];

  for (let c = 0; c < colCount; c++) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      nodes.push({
        c,
        x: colW * (c + 1),
        y: (h / (n + 1)) * (i + 1) + (r() - 0.5) * 40,
      });
    }
  }

  // Edges run forward only, so the thing reads as a pipeline.
  for (const from of nodes) {
    const targets = nodes.filter((n) => n.c === from.c + 1);
    for (const to of targets) {
      if (r() > 0.55) continue;
      const midX = (from.x + to.x) / 2;
      parts.push(
        `<path d="M${from.x.toFixed(0)},${from.y.toFixed(0)} L${midX.toFixed(0)},${from.y.toFixed(0)} ` +
          `L${midX.toFixed(0)},${to.y.toFixed(0)} L${to.x.toFixed(0)},${to.y.toFixed(0)}" ` +
          `fill="none" stroke="${COPPER}" stroke-width="1.6" stroke-opacity="0.46" stroke-linejoin="round"/>`,
      );
      parts.push(
        `<path d="M${(to.x - 11).toFixed(0)},${(to.y - 5).toFixed(0)} L${to.x.toFixed(0)},${to.y.toFixed(0)} ` +
          `L${(to.x - 11).toFixed(0)},${(to.y + 5).toFixed(0)}" fill="none" stroke="${COPPER_HI}" ` +
          `stroke-width="1.6" stroke-opacity="0.65" stroke-linejoin="round"/>`,
      );
    }
  }

  for (const n of nodes) {
    const lead = r() > 0.7;
    parts.push(
      `<rect x="${(n.x - 26).toFixed(0)}" y="${(n.y - 15).toFixed(0)}" width="52" height="30" rx="15" ` +
        `fill="${CARBON}" stroke="${lead ? COPPER_HI : COPPER}" stroke-width="${lead ? 2.2 : 1.5}" ` +
        `stroke-opacity="${lead ? 0.55 : 0.32}"/>`,
    );
  }
  parts.push(finish(w, h, COPPER, [0.5, 0.32]));
  return svg(w, h, parts.join(''));
}

/** Axes and a plotted climb — analysis, not electronics. For technical
 *  consultancy and the estimate page. */
function plotField(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const padX = w * 0.08;
  const padY = h * 0.14;

  for (let i = 0; i <= 6; i++) {
    const y = padY + ((h - padY * 2) / 6) * i;
    parts.push(
      `<line x1="${padX.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(w - padX).toFixed(0)}" y2="${y.toFixed(0)}" ` +
        `stroke="${COPPER}" stroke-width="1" stroke-opacity="0.16"/>`,
    );
  }
  parts.push(
    `<line x1="${padX.toFixed(0)}" y1="${padY.toFixed(0)}" x2="${padX.toFixed(0)}" y2="${(h - padY).toFixed(0)}" ` +
      `stroke="${COPPER}" stroke-width="1.6" stroke-opacity="0.46"/>`,
  );

  // Two series: a stepped one and a smoother one climbing past it.
  const steps = 9;
  const stepW = (w - padX * 2) / steps;
  let sy = h - padY - (h - padY * 2) * 0.12;
  let d = `M${padX.toFixed(0)},${sy.toFixed(0)}`;
  for (let i = 0; i < steps; i++) {
    const nx = padX + stepW * (i + 1);
    sy = Math.max(padY, sy - (h - padY * 2) * (0.02 + r() * 0.12));
    d += ` L${nx.toFixed(0)},${(sy + 0).toFixed(0)} L${nx.toFixed(0)},${sy.toFixed(0)}`;
    parts.push(via(nx, sy, 5, 0.5));
  }
  parts.push(
    `<path d="${d}" fill="none" stroke="${COPPER_HI}" stroke-width="2.6" stroke-opacity="0.7" ` +
      `stroke-linejoin="round" stroke-linecap="round"/>`,
  );

  let by = h - padY - (h - padY * 2) * 0.05;
  let d2 = `M${padX.toFixed(0)},${by.toFixed(0)}`;
  for (let i = 0; i < steps; i++) {
    const nx = padX + stepW * (i + 1);
    by = Math.max(padY * 1.4, by - (h - padY * 2) * (0.01 + r() * 0.07));
    d2 += ` L${nx.toFixed(0)},${by.toFixed(0)}`;
  }
  parts.push(
    `<path d="${d2}" fill="none" stroke="${COPPER}" stroke-width="1.6" stroke-opacity="0.43" ` +
      `stroke-dasharray="7 6"/>`,
  );
  parts.push(finish(w, h, COPPER, [0.68, 0.3]));
  return svg(w, h, parts.join(''));
}

/** Concentric reach from a point off one edge — distribution, audience,
 *  range. For marketing and the contact page. */
function broadcast(seed, w, h) {
  const r = rng(seed);
  const parts = [`<rect width="${w}" height="${h}" fill="${CARBON}"/>`];
  const ox = w * 0.16;
  const oy = h * 0.72;

  for (let i = 1; i <= 16; i++) {
    const rad = i * (Math.max(w, h) / 13);
    const lead = i % 4 === 0;
    parts.push(
      `<circle cx="${ox.toFixed(0)}" cy="${oy.toFixed(0)}" r="${rad.toFixed(0)}" fill="none" ` +
        `stroke="${lead ? COPPER_HI : COPPER}" stroke-width="${lead ? 2 : 1.2}" ` +
        `stroke-opacity="${lead ? 0.3 : 0.14}"/>`,
    );
  }

  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.62 + r() * Math.PI * 0.72;
    const len = Math.max(w, h) * (0.5 + r() * 0.7);
    parts.push(
      `<line x1="${ox.toFixed(0)}" y1="${oy.toFixed(0)}" ` +
        `x2="${(ox + Math.cos(a) * len).toFixed(0)}" y2="${(oy + Math.sin(a) * len).toFixed(0)}" ` +
        `stroke="${COPPER}" stroke-width="1.3" stroke-opacity="0.25"/>`,
    );
  }
  parts.push(via(ox, oy, 11, 0.7));
  parts.push(finish(w, h, COPPER, [0.16, 0.66]));
  return svg(w, h, parts.join(''));
}

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"><defs></defs>${body}</svg>`;
}

// ── Manifest ───────────────────────────────────────────────────────
// Motif follows subject. Every slot below is answerable as "why this
// drawing behind this page" — which the seed-picked version was not: the
// design page carried signal waveforms and the marketing page carried
// circuit traces, because the motif was chosen for variety rather than
// for meaning.
const files = {
  // ── Statement panels ──
  // 'The software and the board it runs on' — the one place a routed
  // board is exactly the subject.
  'statement-duality.svg': routingField(1071, 2400, 1400, { traces: 54, glowAt: [0.22, 0.42] }),
  // 'More than a template' — layout and setting, so the design motif.
  'statement-template.svg': typeGrid(4409, 2400, 1400),

  // ── Page headers ──
  'header-work.svg': moduleGrid(7717, 2400, 900),
  'header-services.svg': nodeGraph(2213, 2400, 900),
  'header-about.svg': plotField(9001, 2400, 900),
  'header-journal.svg': typeGrid(3305, 2400, 900),
  'header-contact.svg': broadcast(5501, 2400, 900),
  'header-estimate.svg': plotField(6602, 2400, 900),

  // ── Industries ──
  // Motif follows the sector, not the seed. A waveform behind healthcare
  // is a vitals trace; behind energy it is metering. A node graph behind
  // logistics is a route network. The same five drawings mean different
  // things depending on what they sit behind, which is the whole reason
  // to choose them per subject rather than rotate them for variety.
  'industry-healthcare.svg': signalField(1101, 1200, 1500),
  'industry-logistics.svg': nodeGraph(1202, 1200, 1500),
  'industry-manufacturing.svg': boardMacro(1303, 1200, 1500),
  'industry-ecommerce.svg': moduleGrid(1404, 1200, 1500),
  'industry-education.svg': typeGrid(1505, 1200, 1500),
  'industry-energy.svg': signalField(1606, 1200, 1500),
  'industry-fintech.svg': plotField(1707, 1200, 1500),
  'industry-agriculture.svg': broadcast(1808, 1200, 1500),
  'industry-software.svg': moduleGrid(1909, 1200, 1500),

  // ── Service lines ──
  'service-development.svg': moduleGrid(101, 1200, 900),
  'service-design.svg': typeGrid(202, 1200, 900),
  'service-iot.svg': boardMacro(303, 1200, 900, COPPER_HI),
  'service-automation.svg': nodeGraph(404, 1200, 900),
  'service-consultancy.svg': plotField(505, 1200, 900),
  'service-support.svg': signalField(606, 1200, 900),
  'service-marketing.svg': broadcast(707, 1200, 900),
};

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(OUT, name), content);
  total += Buffer.byteLength(content);
  console.log(`  ${name.padEnd(30)} ${(Buffer.byteLength(content) / 1024).toFixed(1)} KB`);
}
console.log(`\n${Object.keys(files).length} files, ${(total / 1024).toFixed(1)} KB total`);
