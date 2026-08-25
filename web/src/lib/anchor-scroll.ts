/**
 * Same-page links scroll instead of jumping.
 *
 * Three things have an opinion about what a `#section` click means, and
 * left alone the wrong one wins:
 *
 *  - `scroll-behavior` is pinned to `auto` in global.css so native smooth
 *    scrolling can never fight Lenis. That also means an unhandled hash
 *    link lands as a hard cut.
 *  - Lenis has an `anchors` option that would do this for us.
 *  - Astro's ClientRouter listens for link clicks on `document` and
 *    handles same-page hashes itself.
 *
 * ClientRouter gets there first, so the Lenis option never fires — it is
 * set, it just never sees the event. Rather than have two libraries
 * racing for the same click, this takes the click in the capture phase
 * and stops it there, which makes ownership explicit and gives us the one
 * thing neither of them offers: an offset that clears the fixed nav, so
 * the heading you asked for does not arrive underneath the pill carrying
 * the link you clicked.
 */

/** Clears the fixed nav, with a little air beneath it. */
const NAV_OFFSET = -96;

let onClick: ((e: MouseEvent) => void) | null = null;

function targetFor(hash: string): HTMLElement | null {
  if (!hash || hash === '#') return null;
  let id: string;
  try {
    id = decodeURIComponent(hash.slice(1));
  } catch {
    id = hash.slice(1);
  }
  return document.getElementById(id);
}

export function initAnchorScroll() {
  if (typeof window === 'undefined') return;

  onClick = (event: MouseEvent) => {
    // Leave modified clicks alone — they mean "open elsewhere", and
    // hijacking them is the fastest way to make a link feel broken.
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = (event.target as Element | null)?.closest?.('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;
    if (link.target && link.target !== '_self') return;

    // Either a bare `#id`, or a full path that happens to be this page.
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname !== window.location.pathname) return;

    const target = targetFor(url.hash);
    if (!target) return;

    // Capture phase plus stopPropagation keeps this off ClientRouter's
    // document listener, which runs on the bubble.
    event.preventDefault();
    event.stopPropagation();

    const lenis = window.__lenis;
    if (lenis) {
      lenis.scrollTo(target, { offset: NAV_OFFSET });
    } else {
      // Mobile, or reduced motion: no Lenis instance exists. scrollIntoView
      // takes its behaviour from the argument rather than from the CSS
      // property, so `auto` in the stylesheet does not veto it.
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const top = target.getBoundingClientRect().top + window.scrollY + NAV_OFFSET;
      window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
    }

    // Keep the URL honest so the link is still shareable and the back
    // button still has somewhere to go.
    if (url.hash !== window.location.hash) {
      history.pushState(null, '', url.hash);
    }
  };

  document.addEventListener('click', onClick, { capture: true });
}

export function destroyAnchorScroll() {
  if (onClick) document.removeEventListener('click', onClick, { capture: true });
  onClick = null;
}
