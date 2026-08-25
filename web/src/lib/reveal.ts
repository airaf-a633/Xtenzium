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
 * `panel` is the fourth token, for functional content inside a group — a
 * form, a calculator, anything the reader might want to use immediately.
 * It settles like body copy but never drops below half opacity and never
 * blurs, so the control stays readable and clickable the whole way in.
 *
 * Three rules this encodes, all of which matter more than the numbers:
 *
 *  - Nothing ever replays on scroll-up.
 *  - Cards start at opacity 0.4, never 0 — content is always faintly
 *    present, so nothing flashes blank. Panels hold the same floor, for
 *    the stronger reason that a form at opacity 0 is a form nobody can
 *    fill in if the tween never arrives.
 *  - Anything already inside the viewport on load plays immediately
 *    instead of waiting for a ScrollTrigger that will never fire.
 */

const MOBILE = '(max-width: 767px)';
const DESKTOP = '(min-width: 768px)';
const REDUCED = '(prefers-reduced-motion: reduce)';
const FULL = '(prefers-reduced-motion: no-preference)';

let mm: gsap.MatchMedia | null = null;

/** True when the element is already far enough up the viewport that a
 *  ScrollTrigger with a `top 9x%` start would never fire. */
function alreadyInView(el: Element | undefined) {
  if (!el) return false;
  return el.getBoundingClientRect().top <= window.innerHeight * 0.96;
}

/**
 * A section reveals once per page load, not once per breakpoint.
 *
 * gsap.matchMedia() re-runs its callback whenever the query flips, which is
 * the point — it is how a resize picks up the right distances. But the
 * callback's first act is gsap.set(), so re-running it over a section the
 * reader has already scrolled past would blank that section out and fade it
 * back in behind them. Rotating a tablet must not replay the page.
 *
 * So each container records that it has played on its own dataset. The
 * marker is deliberately not a GSAP-managed property: context.revert()
 * strips inline styles, and it must not strip the memory of having run.
 */
function markPlayed(el: HTMLElement) {
  el.dataset.revealPlayed = '';
}

function hasPlayed(el: HTMLElement) {
  return el.dataset.revealPlayed !== undefined;
}

export function initReveal() {
  if (typeof window === 'undefined') return;

  mm = gsap.matchMedia();

  // ── Reduced motion ──────────────────────────────────────────────
  // Land everything on its final state. Marking the containers played
  // means that if the preference is switched off mid-session we leave
  // the content alone rather than hiding it in order to animate it —
  // the reader asked for less motion, not for a re-entrance.
  mm.add(REDUCED, () => {
    gsap.set(document.querySelectorAll<HTMLElement>('[data-reveal]'), {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'none',
      clearProps: 'filter',
    });
    document
      .querySelectorAll<HTMLElement>('[data-reveal-group], [data-reveal-cards]')
      .forEach(markPlayed);
  });

  // ── Full motion ─────────────────────────────────────────────────
  // One callback, two conditions. Crossing 767px tears down the old
  // triggers and rebuilds them with the other set of distances, which is
  // what the single boolean read at init could never do.
  mm.add(
    {
      isMobile: `${MOBILE} and ${FULL}`,
      isDesktop: `${DESKTOP} and ${FULL}`,
    },
    (context) => {
      const mobile = !!context.conditions?.isMobile;

      // ── Section headers ────────────────────────────────────────
      document.querySelectorAll<HTMLElement>('[data-reveal-group]').forEach((group) => {
        if (hasPlayed(group)) return;

        const eyebrow = group.querySelectorAll('[data-reveal="eyebrow"]');
        const lines = group.querySelectorAll('[data-reveal="line"]');
        const body = group.querySelectorAll('[data-reveal="body"]');
        const panels = group.querySelectorAll('[data-reveal="panel"]');

        if (!eyebrow.length && !lines.length && !body.length && !panels.length) return;

        if (eyebrow.length) gsap.set(eyebrow, { opacity: 0, y: 10 });
        if (lines.length) gsap.set(lines, { opacity: 0, y: 18, filter: 'blur(6px)' });
        if (body.length) gsap.set(body, { opacity: 0, y: 15 });
        if (panels.length) gsap.set(panels, { opacity: 0.5, y: 16 });

        const tl = gsap.timeline({
          onComplete: () => markPlayed(group),
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
        // Alongside the body copy, not after it — a panel is usually the
        // other half of the composition rather than its closing beat.
        if (panels.length) {
          tl.to(panels, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.42');
        }
      });

      // ── Card grids ─────────────────────────────────────────────
      document.querySelectorAll<HTMLElement>('[data-reveal-cards]').forEach((wrap) => {
        if (hasPlayed(wrap)) return;

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
          onComplete: () => markPlayed(wrap),
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
    },
  );
}

export function destroyReveal() {
  mm?.revert();
  mm = null;
}
