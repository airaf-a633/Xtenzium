import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Recipe 02 — the full-height statement panel.
 *
 * A scrub-linked background behind text lines that fire once. Three variants:
 *
 *   default  background pushes in from scale 1.2 and un-blurs
 *   rise     a rounded, rotated card that un-rounds into a full-bleed section
 *   focus    settles, then slowly pushes past; splits into words, not lines
 *
 * The `rise` variant is the one carrying the weight: animating
 * borderRadius 32 → 0 while the panel takes the viewport reads as a card
 * *becoming the page*. Scrubbed tweens use ease:'none' — any other easing
 * fights the scroll position.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

let ctx: gsap.Context | null = null;

export function initStatementPanels() {
  if (typeof window === 'undefined') return;

  const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-statement]'));
  if (!panels.length) return;

  if (window.matchMedia(REDUCED).matches) {
    panels.forEach((panel) => {
      const media = panel.querySelector('[data-statement-media]');
      const inner = panel.querySelector('[data-statement-inner]');
      const lines = panel.querySelectorAll('[data-statement-line]');
      if (media) gsap.set(media, { scale: 1, rotation: 0, borderRadius: 0, filter: 'none' });
      if (inner) gsap.set(inner, { scale: 1, filter: 'none' });
      if (lines.length) gsap.set(lines, { opacity: 1, y: 0, filter: 'none' });
    });
    return;
  }

  ctx = gsap.context(() => {
    panels.forEach((panel) => {
      const variant = panel.dataset.statement || 'default';
      const media = panel.querySelector<HTMLElement>('[data-statement-media]');
      const inner = panel.querySelector<HTMLElement>('[data-statement-inner]');
      const lines = panel.querySelectorAll<HTMLElement>('[data-statement-line]');

      if (variant === 'rise') {
        if (media) {
          gsap.set(media, {
            scale: 1.08,
            rotation: 3,
            borderRadius: 32,
            filter: 'blur(6px)',
            willChange: 'transform, filter',
          });
          gsap.to(media, {
            scale: 1,
            rotation: 0,
            borderRadius: 0,
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: { trigger: panel, start: 'top bottom', end: 'top top', scrub: 0.3 },
          });
        }
        if (lines.length) {
          gsap.set(lines, { opacity: 0, y: 24, filter: 'blur(5px)' });
          gsap.to(lines, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.5,
            stagger: 0.055,
            ease: 'back.out(1.15)',
            scrollTrigger: { trigger: panel, start: 'top 82%', once: true },
          });
        }
        return;
      }

      if (variant === 'focus') {
        if (inner) {
          gsap.set(inner, { scale: 1.08, filter: 'blur(4px)', willChange: 'transform, filter' });
          gsap.to(inner, {
            scale: 1,
            filter: 'blur(0px)',
            ease: 'none',
            scrollTrigger: { trigger: panel, start: 'top bottom', end: 'center center', scrub: 0.8 },
          });
          // Second pass — a slow push past after it settles.
          gsap.fromTo(
            inner,
            { scale: 1 },
            {
              scale: 1.04,
              ease: 'none',
              immediateRender: false,
              scrollTrigger: {
                trigger: panel,
                start: 'center center',
                end: 'bottom top',
                scrub: 0.8,
              },
            },
          );
        }
        if (lines.length) {
          gsap.set(lines, { opacity: 0, y: 16, filter: 'blur(4px)' });
          gsap.to(lines, {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.5,
            stagger: 0.05,
            ease: 'power3.out',
            scrollTrigger: { trigger: panel, start: 'top 84%', once: true },
          });
        }
        return;
      }

      // default
      if (inner) {
        gsap.set(inner, { scale: 1.2, filter: 'blur(8px)', willChange: 'transform, filter' });
        gsap.to(inner, {
          scale: 1,
          filter: 'blur(0px)',
          ease: 'none',
          scrollTrigger: { trigger: panel, start: 'top bottom', end: 'center center', scrub: 0.6 },
        });
      }
      if (lines.length) {
        gsap.set(lines, { opacity: 0, y: 20, filter: 'blur(5px)' });
        gsap.to(lines, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.5,
          stagger: 0.05,
          ease: 'power3.out',
          scrollTrigger: { trigger: panel, start: 'top 84%', once: true },
        });
      }
    });
    // ── Proof columns converge on the seam ─────────────────────────
    //
    // The claim on these panels is that two disciplines meet. Sliding the
    // two halves inward until they do is the one piece of motion here that
    // carries meaning rather than decorating — so it is scrubbed to scroll
    // rather than fired once, and it settles exactly as the seam centres.
    panels.forEach((panel) => {
      const left = panel.querySelector<HTMLElement>('[data-statement-proof="left"]');
      const right = panel.querySelector<HTMLElement>('[data-statement-proof="right"]');
      const seam = panel.querySelector<HTMLElement>('[data-statement-seam]');
      if (!left || !right) return;

      gsap.set([left, right], { willChange: 'transform, opacity' });
      gsap.fromTo(
        left,
        { xPercent: -14, opacity: 0 },
        {
          xPercent: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: { trigger: left, start: 'top 88%', end: 'top 45%', scrub: 0.6 },
        },
      );
      gsap.fromTo(
        right,
        { xPercent: 14, opacity: 0 },
        {
          xPercent: 0,
          opacity: 1,
          ease: 'none',
          scrollTrigger: { trigger: right, start: 'top 88%', end: 'top 45%', scrub: 0.6 },
        },
      );

      if (seam) {
        gsap.fromTo(
          seam,
          { scaleY: 0.3, opacity: 0 },
          {
            scaleY: 1,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: { trigger: seam, start: 'top 78%', once: true },
          },
        );
      }
    });
  });
}

export function destroyStatementPanels() {
  ctx?.revert();
  ctx = null;
}
