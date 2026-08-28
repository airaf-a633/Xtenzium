import gsap from 'gsap';
import { initTraceField } from './trace-field';

/**
 * Recipe 03 — the hero load sequence, in GSAP.
 *
 * This used to be a React island running Motion. That cost 97.6 KB gzipped
 * (React runtime + Motion) loaded blocking, for three masked lines — about
 * 65% of the page's JS for one animation. GSAP is already on the page for
 * the scroll work, so the whole thing is free here.
 *
 * Markup contract:
 *   [data-hero]
 *     [data-hero-eyebrow]
 *     [data-hero-mask] > [data-hero-line]   (repeat per line)
 *     [data-hero-body]
 *     [data-hero-cta]
 *     canvas[data-hero-canvas]
 *
 * Each line sits in an overflow-hidden mask so the text wipes up from
 * behind an edge instead of fading in place. The mask carries a
 * `pb-2 -mb-2` pair so descenders survive the clip without shifting layout.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

let ctx: gsap.Context | null = null;
let disposeField: (() => void) | null = null;

export function initHero() {
  if (typeof window === 'undefined') return;

  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;

  const canvas = hero.querySelector<HTMLCanvasElement>('[data-hero-canvas]');
  if (canvas) disposeField = initTraceField(canvas);

  const eyebrow = hero.querySelectorAll('[data-hero-eyebrow]');
  const lines = hero.querySelectorAll('[data-hero-line]');
  const body = hero.querySelectorAll('[data-hero-body]');
  const cta = hero.querySelectorAll('[data-hero-cta]');

  if (window.matchMedia(REDUCED).matches) {
    gsap.set([...eyebrow, ...lines, ...body, ...cta], { opacity: 1, y: 0, yPercent: 0 });
    return;
  }

  ctx = gsap.context(() => {
    gsap.set(eyebrow, { opacity: 0, y: 10 });
    gsap.set(lines, { yPercent: 115 });
    gsap.set(body, { opacity: 0, y: 18 });
    gsap.set(cta, { opacity: 0, y: 18 });

    const tl = gsap.timeline({ delay: 0.15 });

    tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
      // expo.out is the closest built-in to the reference's [.16, 1, .3, 1].
      .to(lines, { yPercent: 0, duration: 0.85, stagger: 0.08, ease: 'expo.out' }, '-=0.25')
      .to(body, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.45')
      .to(cta, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07, ease: 'power2.out' }, '-=0.35');
  }, hero);
}

export function destroyHero() {
  ctx?.revert();
  ctx = null;
  disposeField?.();
  disposeField = null;
}
