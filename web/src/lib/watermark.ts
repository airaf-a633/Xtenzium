import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * The mark used at page scale, behind section content.
 *
 * Scroll-linked drift and a few degrees of counter-rotation, scrubbed across
 * the section's full pass. Deliberately slow and small in amplitude — a
 * watermark that moves as much as the content reads as a distraction rather
 * than as depth.
 *
 * Only `transform` is animated, so this stays on the compositor and never
 * costs a layout. Opacity is set once in CSS and left alone.
 *
 * Markup:
 *   <section class="relative overflow-hidden">
 *     <div data-watermark data-watermark-drift="10" data-watermark-spin="6">…</div>
 *     <div class="relative z-10">…content…</div>
 *   </section>
 */

let mm: gsap.MatchMedia | null = null;

export function initWatermarks() {
  if (typeof window === 'undefined') return;

  const marks = Array.from(document.querySelectorAll<HTMLElement>('[data-watermark]'));
  if (!marks.length) return;

  mm = gsap.matchMedia();

  // Below 768px the mark is mostly off-canvas anyway, and a second scrubbed
  // trigger per section is not worth the cost on a phone.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.set(marks, { clearProps: 'transform' });
  });

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    marks.forEach((mark) => {
      const section = mark.closest('section') ?? mark.parentElement;
      if (!section) return;

      const drift = parseFloat(mark.dataset.watermarkDrift || '10');
      const spin = parseFloat(mark.dataset.watermarkSpin || '6');

      gsap.set(mark, { yPercent: -drift / 2, rotate: -spin / 2, willChange: 'transform' });

      gsap.to(mark, {
        yPercent: drift / 2,
        rotate: spin / 2,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.1,
          invalidateOnRefresh: true,
        },
      });
    });
  });
}

export function destroyWatermarks() {
  mm?.revert();
  mm = null;
}
