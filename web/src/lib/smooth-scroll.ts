import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis: Lenis | null;
  }
}

/**
 * Desktop-only smooth scroll.
 *
 * Two decisions worth keeping:
 *
 * 1. `autoRaf: false` — Lenis does NOT run its own rAF loop. GSAP's ticker
 *    steps it instead. Without this, Lenis and ScrollTrigger run on separate
 *    frames and every scrubbed animation trails the page by ~1 frame.
 *
 * 2. Below 768px there is no Lenis at all. Smooth-scroll libraries fight
 *    native touch momentum, and the instance is pure cost on mobile.
 */

const MOBILE = '(max-width: 767px)';

let tickerFn: ((time: number) => void) | null = null;

/** easeOutQuart */
const easing = (t: number) => 1 - Math.pow(1 - t, 4);

export function destroySmoothScroll() {
  if (tickerFn) {
    gsap.ticker.remove(tickerFn);
    tickerFn = null;
  }
  if (typeof window !== 'undefined' && window.__lenis) {
    window.__lenis.destroy();
    window.__lenis = null;
  }
}

export function initSmoothScroll() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia(MOBILE).matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  destroySmoothScroll();

  const lenis = new Lenis({
    autoRaf: false,
    smoothWheel: true,
    syncTouch: false,
    allowNestedScroll: true,
    lerp: 0.13,
    wheelMultiplier: 1.2,
    touchMultiplier: 1.35,
    easing,
  });

  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);

  tickerFn = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);

  ScrollTrigger.refresh();
}

/** Re-evaluates on resize so crossing the 768px line does the right thing. */
export function syncSmoothScroll() {
  if (typeof window === 'undefined') return;
  if (window.matchMedia(MOBILE).matches) {
    destroySmoothScroll();
  } else if (!window.__lenis) {
    initSmoothScroll();
  }
  ScrollTrigger.refresh();
}
