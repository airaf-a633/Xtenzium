import gsap from 'gsap';

/**
 * Animated <details> panels.
 *
 * Native disclosure snaps open, which on a long answer reads as a jump.
 * This animates the height while keeping the element genuinely a
 * <details>/<summary> pair — so keyboard, screen readers and find-in-page
 * all still work, and it degrades to the native behaviour without JS.
 *
 * Closing is the fiddly half: the element must stay `open` for the duration
 * of the collapse and only lose the attribute once the height reaches zero,
 * otherwise the content vanishes on frame one.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

const cleanups: Array<() => void> = [];

export function initFaq() {
  if (typeof window === 'undefined') return;
  const items = Array.from(document.querySelectorAll<HTMLDetailsElement>('details'));
  if (!items.length) return;
  if (window.matchMedia(REDUCED).matches) return;

  items.forEach((el) => {
    const summary = el.querySelector('summary');
    const panel = el.querySelector<HTMLElement>('summary ~ *');
    if (!summary || !panel) return;

    let animating = false;

    const onClick = (e: Event) => {
      e.preventDefault();
      if (animating) return;
      animating = true;

      if (!el.open) {
        el.open = true;
        gsap.fromTo(
          panel,
          { height: 0, opacity: 0, marginTop: 0 },
          {
            height: 'auto',
            opacity: 1,
            marginTop: '1rem',
            duration: 0.42,
            ease: 'power2.out',
            onComplete: () => {
              gsap.set(panel, { height: 'auto' });
              animating = false;
            },
          },
        );
      } else {
        gsap.to(panel, {
          height: 0,
          opacity: 0,
          marginTop: 0,
          duration: 0.3,
          ease: 'power2.in',
          onComplete: () => {
            // Only now is it safe to drop the attribute.
            el.open = false;
            gsap.set(panel, { clearProps: 'height,opacity,marginTop' });
            animating = false;
          },
        });
      }
    };

    summary.addEventListener('click', onClick);
    cleanups.push(() => summary.removeEventListener('click', onClick));
  });
}

export function destroyFaq() {
  cleanups.splice(0).forEach((fn) => fn());
}
