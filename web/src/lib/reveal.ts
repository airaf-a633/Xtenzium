import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Recipe 01 — the workhorse section entrance.
 *
 * Markup contract:
 *
 *   <div data-reveal-group>
 *     <p  data-reveal="eyebrow">Section label</p>
 *     <h2><span data-reveal="line">First</span><span data-reveal="line">Second</span></h2>
 *     <p  data-reveal="body">Supporting copy</p>
 *   </div>
 *
 *   <div data-reveal-cards>
 *     <article data-reveal="card">…</article>
 *   </div>
 *
 * Three rules this encodes, all of which matter more than the numbers:
 *
 *  - Nothing ever replays on scroll-up.
 *  - Cards start at opacity 0.4, never 0 — content is always faintly
 *    present, so nothing flashes blank.
 *  - Anything already inside the viewport on load plays immediately
 *    instead of waiting for a ScrollTrigger that will never fire.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';
const MOBILE = '(max-width: 767px)';

type Ctx = gsap.Context | null;
let ctx: Ctx = null;

function isReduced() {
  return window.matchMedia(REDUCED).matches;
}

/** True when the element is already far enough up the viewport that a
 *  ScrollTrigger with a `top 9x%` start would never fire. */
function alreadyInView(el: Element | undefined) {
  if (!el) return false;
  return el.getBoundingClientRect().top <= window.innerHeight * 0.96;
}

export function initReveal() {
  if (typeof window === 'undefined') return;

  const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-group]'));
  const cardWraps = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal-cards]'));

  // Reduced motion: land everything on its final state and stop.
  if (isReduced()) {
    const all = document.querySelectorAll<HTMLElement>('[data-reveal]');
    gsap.set(all, { opacity: 1, y: 0, scale: 1, filter: 'none', clearProps: 'filter' });
    return;
  }

  const mobile = window.matchMedia(MOBILE).matches;

  ctx = gsap.context(() => {
    // ── Section headers ────────────────────────────────────────────
    groups.forEach((group) => {
      const eyebrow = group.querySelectorAll('[data-reveal="eyebrow"]');
      const lines = group.querySelectorAll('[data-reveal="line"]');
      const body = group.querySelectorAll('[data-reveal="body"]');

      if (!eyebrow.length && !lines.length && !body.length) return;

      if (eyebrow.length) gsap.set(eyebrow, { opacity: 0, y: 10 });
      if (lines.length) gsap.set(lines, { opacity: 0, y: 18, filter: 'blur(6px)' });
      if (body.length) gsap.set(body, { opacity: 0, y: 15 });

      const tl = gsap.timeline({
        scrollTrigger: alreadyInView(group)
          ? undefined
          : { trigger: group, start: 'top 95%', once: true },
      });

      if (eyebrow.length) {
        tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
      }
      if (lines.length) {
        tl.to(
          lines,
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.5,
            stagger: 0.035,
            ease: 'power3.out',
          },
          '-=0.2',
        );
      }
      if (body.length) {
        tl.to(body, { opacity: 1, y: 0, duration: 0.42, ease: 'power2.out' }, '-=0.2');
      }
    });

    // ── Card grids ─────────────────────────────────────────────────
    cardWraps.forEach((wrap) => {
      const cards = wrap.querySelectorAll<HTMLElement>('[data-reveal="card"]');
      if (!cards.length) return;

      gsap.set(cards, {
        opacity: mobile ? 0.55 : 0.4,
        y: mobile ? 20 : 28,
        scale: mobile ? 0.95 : 0.94,
        filter: `blur(${mobile ? 6 : 8}px)`,
        transformOrigin: '50% 50%',
      });

      const settled: gsap.TweenVars = {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        stagger: mobile ? 0.025 : 0.04,
        duration: mobile ? 0.55 : 0.6,
        ease: 'power3.out',
      };

      if (alreadyInView(cards[0])) {
        gsap.to(cards, settled);
      } else {
        gsap.to(cards, {
          ...settled,
          scrollTrigger: {
            trigger: cards[0],
            start: `top ${mobile ? 92 : 88}%`,
            once: true,
          },
        });
      }
    });
  });
}

export function destroyReveal() {
  ctx?.revert();
  ctx = null;
}
