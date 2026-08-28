import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Horizontal gallery, driven by vertical scroll.
 *
 * Two variants of one idea, and the difference is pinning rather than
 * motion:
 *
 *   desktop  the section pins and the track travels its full width while
 *            the page is held still. The reader is inside the gallery
 *            until it finishes.
 *   mobile   no pin. The track travels as the section passes through the
 *            viewport, so scrolling moves the cards sideways but never
 *            stops moving the page.
 *
 * The mobile variant used to be a native horizontal scroller, on the
 * reasoning that swiping is the better touch interaction. That is true in
 * isolation and wrong in context: the cards then sat perfectly still while
 * everything around them moved, and a reader who never thinks to swipe
 * sees one and a half cards and assumes that is all there is.
 *
 * What makes this safe on touch is only that it does not pin. Pinning is
 * what turns scroll-driven horizontal movement into scroll hijacking —
 * the page stops responding to the gesture the reader is making — and
 * that is the part left on desktop, where a pointer makes it legible.
 *
 * `ease: 'none'` is mandatory with scrub; any curve fights the scroll
 * position and the track feels like it is lagging. Distances are
 * functions so `invalidateOnRefresh` recomputes them on resize rather
 * than pinning to a stale width.
 *
 * Markup:
 *   <section data-hgallery>
 *     <div data-hgallery-track>…cards…</div>
 *   </section>
 */

const FULL = '(prefers-reduced-motion: no-preference)';
const PINNED = '(min-width: 1024px)';
const UNPINNED = '(max-width: 1023px)';

let mm: gsap.MatchMedia | null = null;

export function initHorizontalGallery() {
  if (typeof window === 'undefined') return;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-hgallery]'));
  if (!sections.length) return;

  mm = gsap.matchMedia();

  // Reduced motion keeps the native scroller: the reader moves it, or it
  // does not move.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    sections.forEach((s) => {
      const track = s.querySelector<HTMLElement>('[data-hgallery-track]');
      if (track) gsap.set(track, { x: 0 });
      s.setAttribute('data-hgallery-native', '');
    });
    return () => sections.forEach((s) => s.removeAttribute('data-hgallery-native'));
  });

  mm.add(
    {
      isPinned: `${PINNED} and ${FULL}`,
      isFlowing: `${UNPINNED} and ${FULL}`,
    },
    (context) => {
      const pinned = !!context.conditions?.isPinned;

      sections.forEach((section) => {
        const track = section.querySelector<HTMLElement>('[data-hgallery-track]');
        if (!track) return;

        // The transform drives the track, so native overflow must not also
        // be trying to. Leaving both on gives a scroller that fights its
        // own animation.
        section.removeAttribute('data-hgallery-native');

        const distance = () =>
          Math.max(0, track.scrollWidth - window.innerWidth + (pinned ? 96 : 24));

        gsap.set(track, { willChange: 'transform' });

        gsap.fromTo(
          track,
          { x: 0 },
          {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: pinned
              ? {
                  trigger: section,
                  start: 'top top',
                  end: () => '+=' + distance(),
                  pin: true,
                  scrub: 0.6,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                }
              : {
                  // Across the section's own pass through the viewport, so
                  // the page never stops for it.
                  trigger: section,
                  start: 'top bottom',
                  end: 'bottom top',
                  scrub: 0.6,
                  invalidateOnRefresh: true,
                },
          },
        );
      });
    },
  );
}

export function destroyHorizontalGallery() {
  mm?.revert();
  mm = null;
}
