import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Recipe 06 — the other half of a section's life.
 *
 * Markup contract:
 *
 *   <section class="…">
 *     <div class="container-x" data-exit>…</div>
 *   </section>
 *
 * Every section on this site arrives and then nothing further happens to
 * it. reveal.ts brings it in, it sits at full weight until it is gone, and
 * the next section arrives against a neighbour that is still shouting.
 * Sections were animated; the page between them was not. That is what
 * reads as a hard cut at the seams.
 *
 * So content recedes as you scroll past it — opacity and a little upward
 * drift, scrubbed to scroll position rather than played. Scrubbed is the
 * important part: an entrance is an event and should never replay, but a
 * departure is a position. Scroll back up and the section comes back,
 * because it is not an animation with a memory, it is a function of where
 * you are on the page.
 *
 * Two deliberate limits:
 *
 *  - Opt-in, not automatic. A transform creates a containing block for
 *    fixed and sticky descendants, so applying this to a section that
 *    pins — the horizontal gallery — breaks the pin outright. Sections
 *    ask for it by marking their own content wrapper.
 *  - The wrapper, never the <section>. Same reason: the section is the
 *    element a pin measures against, and the ground colour must not move
 *    with the content or the seam it is hiding starts sliding around.
 */

const FULL = '(prefers-reduced-motion: no-preference)';
/** Below this the viewport is short, scrolling is fast, and fading content
 *  the reader is still trying to read is a cost with no benefit. */
const DESKTOP = '(min-width: 768px)';

let mm: gsap.MatchMedia | null = null;

export function initSectionExit() {
  if (typeof window === 'undefined') return;

  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-exit]'));
  if (!targets.length) return;

  mm = gsap.matchMedia();

  mm.add(`${DESKTOP} and ${FULL}`, () => {
    targets.forEach((el) => {
      gsap.to(el, {
        opacity: 0.18,
        y: -34,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          // Begins only once the content's bottom is well up the screen,
          // so nothing dims while there is still reading left in it.
          start: 'bottom 62%',
          end: 'bottom top',
          scrub: 0.4,
          invalidateOnRefresh: true,
        },
      });
    });
  });
}

export function destroySectionExit() {
  mm?.revert();
  mm = null;
}
