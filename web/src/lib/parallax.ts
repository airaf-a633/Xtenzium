import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * <ParallaxImage /> driver.
 *
 * The frame clips; the image inside is oversized (scale 1.2) and drifts on
 * the y-axis against scroll. The overscale is what buys the travel — without
 * it the image edge would show at the extremes of the drift.
 *
 * Markup:
 *   <div data-parallax data-parallax-strength="14">
 *     <img data-parallax-img />
 *   </div>
 *
 * strength = percent of height travelled across the full pass.
 */

let mm: gsap.MatchMedia | null = null;

export function initParallax() {
  if (typeof window === 'undefined') return;

  const frames = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!frames.length) return;

  mm = gsap.matchMedia();

  // Reduced motion only. Small screens used to be excluded here too, on
  // the grounds that the travel wasn't worth the work — but the work is a
  // single composited yPercent, and a phone is where a static image in a
  // clipped frame most obviously reads as a picture that failed to load.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    frames.forEach((frame) => {
      const img = frame.querySelector('[data-parallax-img]');
      if (img) gsap.set(img, { yPercent: 0, scale: 1.06 });
    });
  });

  mm.add(
    {
      isMobile: '(max-width: 767px) and (prefers-reduced-motion: no-preference)',
      isDesktop: '(min-width: 768px) and (prefers-reduced-motion: no-preference)',
    },
    (context) => {
    const mobile = !!context.conditions?.isMobile;
    frames.forEach((frame) => {
      const img = frame.querySelector<HTMLElement>('[data-parallax-img]');
      if (!img) return;
      // Less travel on a phone: the frame is shorter, so the same
      // percentage shows more of the overscale and less of the picture.
      const base = parseFloat(frame.dataset.parallaxStrength || '14');
      const strength = mobile ? base * 0.55 : base;

      gsap.set(img, { scale: 1.2, yPercent: -strength / 2, willChange: 'transform' });

      gsap.to(img, {
        yPercent: strength / 2,
        ease: 'none',
        scrollTrigger: {
          trigger: frame,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    });
    },
  );
}

export function destroyParallax() {
  mm?.revert();
  mm = null;
}
