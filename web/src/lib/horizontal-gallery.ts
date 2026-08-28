import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Pinned horizontal gallery.
 *
 * The section pins; vertical scroll is translated into x on the inner track.
 * `ease: 'none'` is mandatory here — with `scrub` active, any easing curve
 * fights the scroll position and the track feels like it is lagging.
 *
 * Distances are functions rather than values so `invalidateOnRefresh` can
 * recompute them on resize instead of pinning to a stale width.
 *
 * Markup:
 *   <section data-hgallery>
 *     <div data-hgallery-track>…cards…</div>
 *   </section>
 */

let mm: gsap.MatchMedia | null = null;

export function initHorizontalGallery() {
  if (typeof window === 'undefined') return;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-hgallery]'));
  if (!sections.length) return;

  mm = gsap.matchMedia();

  // Without pinning this stays a native horizontal scroller, which is the
  // better interaction on touch anyway.
  mm.add('(prefers-reduced-motion: reduce), (max-width: 1023px)', () => {
    sections.forEach((s) => {
      const track = s.querySelector<HTMLElement>('[data-hgallery-track]');
      if (track) gsap.set(track, { x: 0 });
      s.setAttribute('data-hgallery-native', '');
    });
    return () => sections.forEach((s) => s.removeAttribute('data-hgallery-native'));
  });

  mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
    sections.forEach((section) => {
      const track = section.querySelector<HTMLElement>('[data-hgallery-track]');
      if (!track) return;

      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 96);

      gsap.set(track, { willChange: 'transform' });

      gsap.to(track, {
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
      });
    });
  });
}

export function destroyHorizontalGallery() {
  mm?.revert();
  mm = null;
}
