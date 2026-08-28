import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initTraceField } from './trace-field';

gsap.registerPlugin(ScrollTrigger);

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
 *
 * ── Parallax ───────────────────────────────────────────────────────
 *
 * On scroll the hero separates into two planes. The trace field drifts
 * downward, which is what reads as distance: it is being left behind by a
 * page moving up past it. The copy goes the other way and dims, so it
 * leaves rather than merely being covered.
 *
 * The scrim between them does not move. It is there to keep white text
 * legible over the field, and a scrim that drifts stops covering the thing
 * it was drawn for.
 *
 * The canvas is translated and never scaled. Scaling a canvas resamples
 * whatever it has already painted, and this one is painting continuously —
 * the result is a soft, slightly wrong trace field rather than a nearer
 * one.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

let ctx: gsap.Context | null = null;
let mm: gsap.MatchMedia | null = null;
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

  // ── Scroll parallax, both plane and phone ───────────────────────
  //
  // Gentler on a phone for a reason that is geometric rather than a
  // matter of taste: a hero is a viewport tall, so on a short screen the
  // same percentage of travel covers far more of what the reader can see
  // at once, and the copy is gone before it has been read.
  mm = gsap.matchMedia();

  mm.add(
    {
      isMobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
      isDesktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    },
    (context) => {
      const mobile = !!context.conditions?.isMobile;
      const content = hero.querySelector<HTMLElement>('[data-hero-content]');

      // One trigger for both planes: they must be driven by the same
      // scroll range or the gap between them opens unevenly.
      const st = {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        // ease: 'none' is not optional under scrub — a curve fights the
        // scroll position and the layer reads as lagging rather than distant.
        scrub: true,
        invalidateOnRefresh: true,
      } as const;

      if (canvas) {
        gsap.fromTo(
          canvas,
          { yPercent: 0 },
          { yPercent: mobile ? 12 : 22, ease: 'none', scrollTrigger: { ...st } },
        );
      }

      if (content) {
        gsap.fromTo(
          content,
          { yPercent: 0, opacity: 1 },
          {
            yPercent: mobile ? -6 : -14,
            opacity: mobile ? 0.35 : 0.12,
            ease: 'none',
            scrollTrigger: { ...st },
          },
        );
      }
    },
  );
}

export function destroyHero() {
  ctx?.revert();
  ctx = null;
  mm?.revert();
  mm = null;
  disposeField?.();
  disposeField = null;
}
