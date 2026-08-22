import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Number counters.
 *
 *   <span data-count-to="65" data-count-suffix="+">65+</span>
 *
 * The element ships with its final value already in the HTML, so the real
 * number is present for crawlers and for anyone with JS off or reduced
 * motion on. The animation only ever rewinds it and plays it forward.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

let ctx: gsap.Context | null = null;

export function initCounters() {
  if (typeof window === 'undefined') return;

  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-count-to]'));
  if (!els.length) return;
  if (window.matchMedia(REDUCED).matches) return;

  ctx = gsap.context(() => {
    els.forEach((el) => {
      const to = parseFloat(el.dataset.countTo || '0');
      if (Number.isNaN(to)) return;
      const prefix = el.dataset.countPrefix || '';
      const suffix = el.dataset.countSuffix || '';
      const decimals = (el.dataset.countTo || '').split('.')[1]?.length ?? 0;
      const box = { v: 0 };

      const write = () => {
        el.textContent = prefix + box.v.toFixed(decimals) + suffix;
      };

      const play = () =>
        gsap.to(box, { v: to, duration: 1.6, ease: 'power2.out', onUpdate: write });

      // Already on screen at load? Play now — a ScrollTrigger that starts
      // above the fold never fires.
      if (el.getBoundingClientRect().top <= window.innerHeight * 0.96) {
        write();
        play();
      } else {
        write();
        ScrollTrigger.create({
          trigger: el,
          start: 'top 90%',
          once: true,
          onEnter: play,
        });
      }
    });
  });
}

export function destroyCounters() {
  ctx?.revert();
  ctx = null;
}
