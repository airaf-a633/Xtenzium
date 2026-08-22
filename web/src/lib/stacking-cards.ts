import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Sticky stacking cards.
 *
 * The pinning is done by CSS `position: sticky`, not by ScrollTrigger.
 *
 * That is deliberate. Pinning every card with `pinSpacing: false` collapses
 * the space each one would have occupied, which drags the following cards up
 * until they all share the same scroll position — and then all their depth
 * tweens fire in lockstep instead of one after another. Sticky keeps every
 * card in natural document flow, so each keeps a distinct trigger position
 * and the stagger falls out for free.
 *
 * GSAP is left doing the one thing CSS cannot: scrubbing the card underneath
 * down in scale and brightness as the next one climbs over it.
 *
 * Markup:
 *   <div data-stack>
 *     <section data-stack-card><div data-stack-inner>…</div></section>
 *   </div>
 */

let mm: gsap.MatchMedia | null = null;

export function initStackingCards() {
  if (typeof window === 'undefined') return;

  const groups = Array.from(document.querySelectorAll<HTMLElement>('[data-stack]'));
  if (!groups.length) return;

  mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: reduce), (max-width: 767px)', () => {
    groups.forEach((group) => {
      const inners = group.querySelectorAll('[data-stack-inner]');
      gsap.set(inners, { scale: 1, clearProps: 'filter,transform' });
    });
  });

  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    groups.forEach((group) => {
      const cards = Array.from(group.querySelectorAll<HTMLElement>('[data-stack-card]'));
      if (cards.length < 2) return;

      // One timeline on the GROUP, which is not sticky.
      //
      // A sticky element reports a position that changes as it sticks, so
      // ScrollTrigger cannot use one as a trigger without measuring garbage.
      // The group stays in normal flow, so its start and end are stable, and
      // each card gets its own slot along the timeline — which is what
      // produces the stagger.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: group,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      cards.slice(0, -1).forEach((card, i) => {
        const inner = card.querySelector<HTMLElement>('[data-stack-inner]');
        if (!inner) return;

        gsap.set(inner, { willChange: 'transform, filter' });

        tl.fromTo(
          inner,
          { scale: 1, filter: 'brightness(1)' },
          { scale: 0.95, filter: 'brightness(0.55)', ease: 'none', duration: 1 },
          i,
        );
      });
    });
  });
}

export function destroyStackingCards() {
  mm?.revert();
  mm = null;
}
