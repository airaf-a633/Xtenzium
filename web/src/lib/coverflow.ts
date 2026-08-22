import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Curved 3D coverflow.
 *
 * Cards are laid out absolutely and positioned entirely from a single
 * progress value, so there is one source of truth and no per-card triggers.
 * Progress is scrubbed by ScrollTrigger; every card derives its own
 * transform from its distance to the focused index.
 *
 * The arc comes from pairing rotateY with a small y lift — rotation alone
 * reads as a flat fan rather than a curve.
 *
 * Markup:
 *   <div data-coverflow>
 *     <div data-coverflow-stage>
 *       <article data-coverflow-card>…</article>
 *     </div>
 *   </div>
 */

const SPREAD = 62;   // % of card width between neighbours
const ROTATE = 26;   // deg of rotateY per step out from centre
const LIFT = 26;     // px of y drop per step — this is what curves it
const SCALE_STEP = 0.11;
const FADE_STEP = 0.3;

let mm: gsap.MatchMedia | null = null;

function apply(cards: HTMLElement[], focus: number) {
  const mid = (cards.length - 1) / 2;
  cards.forEach((card, i) => {
    const d = i - focus;              // signed distance from focus
    const a = Math.abs(d);
    gsap.set(card, {
      xPercent: -50 + d * SPREAD,
      yPercent: -50,
      y: a * LIFT,
      rotateY: -d * ROTATE,
      scale: Math.max(0.6, 1 - a * SCALE_STEP),
      opacity: Math.max(0, 1 - a * FADE_STEP),
      zIndex: Math.round(100 - a * 10),
      pointerEvents: a < 0.5 ? 'auto' : 'none',
    });
    card.setAttribute('aria-hidden', a < 0.5 ? 'false' : 'true');
    void mid;
  });
}

export function initCoverflow() {
  if (typeof window === 'undefined') return;

  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-coverflow]'));
  if (!roots.length) return;

  mm = gsap.matchMedia();

  // Reduced motion / small screens fall back to a plain scroll-snap row,
  // which the CSS already provides once this attribute is set.
  mm.add('(prefers-reduced-motion: reduce), (max-width: 767px)', () => {
    roots.forEach((root) => {
      root.setAttribute('data-coverflow-flat', '');
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      gsap.set(cards, { clearProps: 'all' });
      cards.forEach((c) => c.setAttribute('aria-hidden', 'false'));
    });
    return () => roots.forEach((r) => r.removeAttribute('data-coverflow-flat'));
  });

  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    roots.forEach((root) => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      if (!cards.length) return;

      gsap.set(cards, { willChange: 'transform, opacity' });
      const state = { focus: 0 };
      apply(cards, 0);

      gsap.to(state, {
        focus: cards.length - 1,
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top 75%',
          end: 'bottom 25%',
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
        onUpdate: () => apply(cards, state.focus),
      });
    });
  });
}

export function destroyCoverflow() {
  mm?.revert();
  mm = null;
}
