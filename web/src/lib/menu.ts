import gsap from 'gsap';

/**
 * Fullscreen site menu.
 *
 * A modal dialog, so it owes the user four things beyond looking right:
 * focus moves in and is trapped while open, Escape closes it, focus returns
 * to the button that opened it, and the page behind cannot scroll.
 *
 * Lenis has to be stopped rather than just `overflow: hidden` — the smooth
 * scroller drives its own transform and would keep moving the page behind
 * the overlay otherwise.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

let cleanup: Array<() => void> = [];

export function initMenu() {
  if (typeof window === 'undefined') return;

  const menuEl = document.querySelector<HTMLElement>('[data-menu]');
  const openEl = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  const closeEl = document.querySelector<HTMLButtonElement>('[data-menu-close]');
  if (!menuEl || !openEl || !closeEl) return;

  // Bind to explicitly non-null consts: control-flow narrowing does not
  // survive into the nested handlers below.
  const menu: HTMLElement = menuEl;
  const openBtn: HTMLButtonElement = openEl;
  const closeBtn: HTMLButtonElement = closeEl;

  const items = Array.from(menu.querySelectorAll<HTMLElement>('[data-menu-item]'));
  const reduced = window.matchMedia(REDUCED).matches;
  let isOpen = false;

  function open() {
    if (isOpen) return;
    isOpen = true;
    menu.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');

    document.documentElement.style.overflow = 'hidden';
    window.__lenis?.stop();

    if (reduced) {
      gsap.set([menu, ...items], { opacity: 1, y: 0 });
    } else {
      gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power2.out' });
      gsap.fromTo(
        items,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', delay: 0.06 },
      );
    }

    closeBtn.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    openBtn.setAttribute('aria-expanded', 'false');

    const finish = () => {
      menu.hidden = true;
      document.documentElement.style.overflow = '';
      window.__lenis?.start();
      // Focus goes back where it came from, not to the top of the page.
      openBtn.focus();
    };

    if (reduced) finish();
    else gsap.to(menu, { opacity: 0, duration: 0.22, ease: 'power2.in', onComplete: finish });
  }

  function onKey(e: KeyboardEvent) {
    if (!isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    if (e.key !== 'Tab') return;

    // Trap: wrap focus at both ends of the dialog.
    const focusables = Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null,
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  // Any navigation from inside the menu should also dismiss it.
  const onNavigate = () => close();
  menu.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', onNavigate));

  cleanup = [
    () => openBtn.removeEventListener('click', open),
    () => closeBtn.removeEventListener('click', close),
    () => document.removeEventListener('keydown', onKey),
    () => menu.querySelectorAll('a[href]').forEach((a) => a.removeEventListener('click', onNavigate)),
    () => {
      // Never leave the page unscrollable behind a torn-down menu.
      document.documentElement.style.overflow = '';
      window.__lenis?.start();
    },
  ];
}

export function destroyMenu() {
  cleanup.splice(0).forEach((fn) => fn());
}
