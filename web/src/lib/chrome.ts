import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Page chrome: the nav's scrolled state and the reading-progress bar.
 *
 * Both are functional rather than decorative. The nav needs to stop being
 * translucent once content is behind it, and a long page benefits from
 * telling you how much is left. Neither is an effect for its own sake.
 *
 * The progress bar drives `scaleX` on the compositor rather than `width`,
 * which would relayout on every scroll frame.
 */

let ctx: gsap.Context | null = null;

export function initChrome() {
  if (typeof window === 'undefined') return;

  const shell = document.querySelector<HTMLElement>('[data-nav-shell]');
  const bar = document.querySelector<HTMLElement>('[data-progress]');
  if (!shell && !bar) return;

  ctx = gsap.context(() => {
    // ── Nav: solidify once anything is scrolled behind it ──────────
    if (shell) {
      ScrollTrigger.create({
        start: 'top -80',
        end: 99999,
        onToggle: (self) => shell.classList.toggle('is-scrolled', self.isActive),
      });
    }

    // ── Reading progress ───────────────────────────────────────────
    if (bar) {
      // Position, not time — no easing, no scrub lag. The bar should be
      // exactly where the scrollbar is.
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          bar.style.scale = `${self.progress.toFixed(4)} 1`;
        },
      });
    }
  });
}

export function destroyChrome() {
  ctx?.revert();
  ctx = null;
}
