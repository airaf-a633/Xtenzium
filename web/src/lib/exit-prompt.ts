import gsap from 'gsap';
import { track } from './analytics';

/**
 * A single, quiet prompt for a reader who is leaving.
 *
 * This site argues against pitch decks and discovery fees, and says "no
 * form, no email required" in its own copy. A full-screen modal demanding
 * an address would contradict the page it appears over, and a reader who
 * came here because the tone was straight is exactly the reader who
 * notices. So this is deliberately the mildest version of the pattern:
 *
 *  - A panel in the corner, not a modal. It covers nothing, traps no
 *    focus, and the page stays usable behind it.
 *  - It offers the two things already on offer everywhere else. Nothing
 *    is withheld to create the prompt, because withholding something in
 *    order to ask for an email is the move this site is positioned
 *    against.
 *  - Once per session, and never again once dismissed.
 *  - Never on /contact or /estimate. A reader already filling in a form
 *    does not need to be asked to go and fill in a form.
 *
 * Dismissal is remembered in sessionStorage rather than a cookie, which
 * keeps the privacy page true: nothing here is readable by us, and it is
 * gone when the tab closes.
 */

const KEY = 'xtz:exit-prompt';
/** Pages where the reader is already converting. */
const SKIP = ['/contact', '/estimate'];

let cleanup: Array<() => void> = [];
let shown = false;

function dismissed() {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    // Private mode. Treat it as dismissed: an unrememberable prompt that
    // could reappear on every page is worse than no prompt.
    return true;
  }
}

function remember() {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* nothing to do */
  }
}

export function initExitPrompt() {
  if (typeof window === 'undefined') return;

  const panel = document.querySelector<HTMLElement>('[data-exit-prompt]');
  if (!panel) return;

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (SKIP.some((p) => path.startsWith(p)) || dismissed()) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const close = () => {
    remember();
    if (reduced) {
      panel.hidden = true;
      return;
    }
    gsap.to(panel, {
      opacity: 0,
      y: 12,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        panel.hidden = true;
      },
    });
  };

  const open = () => {
    if (shown || dismissed()) return;
    shown = true;
    panel.hidden = false;
    track('exit_prompt_shown');
    if (reduced) return;
    gsap.fromTo(
      panel,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' },
    );
  };

  // ── Desktop: the pointer leaves through the top of the window ────
  // Only upward, and only from near the top: a pointer exiting sideways
  // is reaching for a second monitor, and one exiting downward is heading
  // for the taskbar. Neither is somebody leaving.
  const onOut = (e: MouseEvent) => {
    if (e.clientY <= 0 && !e.relatedTarget) open();
  };
  document.addEventListener('mouseout', onOut);
  cleanup.push(() => document.removeEventListener('mouseout', onOut));

  // ── Touch: there is no exit intent to detect ────────────────────
  // Nothing on a phone signals "about to leave", so the honest trigger is
  // engagement instead: someone who has read most of a page has earned
  // being asked, and someone who bounced in the first screen has not.
  if (window.matchMedia('(max-width: 767px)').matches) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (max > 0 && window.scrollY / max > 0.72) open();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => window.removeEventListener('scroll', onScroll));
  }

  const closer = panel.querySelector<HTMLButtonElement>('[data-exit-prompt-close]');
  closer?.addEventListener('click', close);
  cleanup.push(() => closer?.removeEventListener('click', close));

  // Escape closes it, because anything that appears unbidden should.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !panel.hidden) close();
  };
  document.addEventListener('keydown', onKey);
  cleanup.push(() => document.removeEventListener('keydown', onKey));

  // Following either link counts as answering it.
  panel.querySelectorAll('a').forEach((a) => {
    const onClick = () => {
      track('exit_prompt_click', { href: a.getAttribute('href') });
      remember();
    };
    a.addEventListener('click', onClick);
    cleanup.push(() => a.removeEventListener('click', onClick));
  });
}

export function destroyExitPrompt() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  shown = false;
}
