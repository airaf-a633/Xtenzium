import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Pinned horizontal gallery.
 *
 * The section pins and vertical scroll is translated into x on the inner
 * track, at every width. An unpinned variant was tried on mobile — travel
 * spread across the section's own pass through the viewport — on the
 * reasoning that pinning hijacks a touch scroll. It reads worse for a
 * reason that is easy to miss in principle and obvious in use: travel
 * begins the moment the section's top touches the bottom of the screen,
 * so by the time the row is high enough to read, a third of it has
 * already gone past. The reader arrives in the middle of something.
 *
 * Pinning is what ties the travel to the part of the pass the reader is
 * actually looking at. It costs the page holding still for the length of
 * the row; that is the trade, and it is the same one on every device.
 *
 * `ease: 'none'` is mandatory with scrub — any curve fights the scroll
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

  // Pinned at every width.
  //
  // The unpinned version travelled across the section's own pass through
  // the viewport, which sounds gentler and reads worse: travel starts the
  // moment the section's top touches the bottom of the screen, so by the
  // time it is high enough to read, a third of the row has already gone
  // past. The reader arrives in the middle of something.
  //
  // Pinning is what ties the travel to the part of the pass where the
  // reader is actually looking at it. It costs the page holding still for
  // the length of the row, which is the trade — and the same trade the
  // desktop has always made.
  mm.add(FULL, () => {
    sections.forEach((section) => {
      const track = section.querySelector<HTMLElement>('[data-hgallery-track]');
      if (!track) return;

      // The transform drives the track, so native overflow must not also
      // be trying to. Two things on one axis is a scroller fighting its
      // own animation.
      section.removeAttribute('data-hgallery-native');

      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 48);

      gsap.set(track, { willChange: 'transform' });

      gsap.fromTo(
        track,
        { x: 0 },
        {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => '+=' + distance(),
            pin: true,
            scrub: 0.6,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        },
      );
    });
  });
}

export function destroyHorizontalGallery() {
  mm?.revert();
  mm = null;
}
