import { getSupabase, isConfigured } from './supabase';

/**
 * First-party analytics.
 *
 * Writes to `page_events` (migration 006). No third-party script, no
 * cookie, no consent banner — see the migration header for why the
 * identifier is shaped the way it is.
 *
 * Four rules this file exists to keep:
 *
 *  1. It never blocks. Every send is fire-and-forget and every failure is
 *     swallowed. Analytics that can break a page is worse than no
 *     analytics, and this one sits on the critical path of a lead form.
 *  2. It never sends a URL. Only `location.pathname`, and only the
 *     referring host — a query string can carry an address somebody typed
 *     into a form, and the estimator puts an email in one.
 *  3. It respects Do Not Track and Global Privacy Control. Neither is
 *     legally binding here; ignoring an explicit signal while claiming to
 *     be the privacy-respecting option is not a position worth holding.
 *  4. It batches. One insert per event would be a request per scroll
 *     threshold; events queue and flush together, and on page hide via
 *     sendBeacon so the last batch survives the navigation.
 */

export type EventName =
  | 'pageview'
  | 'scroll_depth'
  | 'outbound_click'
  | 'form_start'
  | 'form_submit'
  | 'estimate_step'
  | 'estimate_complete'
  | 'exit_prompt_shown'
  | 'exit_prompt_click';

const VISITOR_KEY = 'xtz:visitor';
const FLUSH_MS = 2000;
const MAX_BATCH = 20;

type Event = {
  name: EventName;
  path: string;
  referrer: string | null;
  visitor: string;
  device: 'mobile' | 'tablet' | 'desktop';
  props: Record<string, unknown>;
};

let queue: Event[] = [];
let timer: number | null = null;
let cleanup: Array<() => void> = [];
let enabled = false;

/** An explicit opt-out from the browser or an extension. */
function optedOut() {
  if (typeof navigator === 'undefined') return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return (
    n.doNotTrack === '1' ||
    n.globalPrivacyControl === true ||
    (window as unknown as { doNotTrack?: string }).doNotTrack === '1'
  );
}

/**
 * Per-session id, minted in the browser.
 *
 * sessionStorage rather than a cookie: it is never sent automatically
 * with a request, it is gone when the tab closes, and it keeps the claim
 * on /privacy that this site sets no cookies literally true.
 */
function visitorId(): string | null {
  try {
    let id = sessionStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Private mode, or storage blocked. No id means no session, and a
    // row without one is not worth the write.
    return null;
  }
}

function device(): Event['device'] {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/** Host only. The full referring URL carries other people's queries. */
function referringHost(): string | null {
  if (!document.referrer) return null;
  try {
    const url = new URL(document.referrer);
    if (url.host === window.location.host) return null; // internal
    return url.host;
  } catch {
    return null;
  }
}

async function flush(useBeacon = false) {
  if (!queue.length) return;
  const batch = queue;
  queue = [];

  if (timer) {
    window.clearTimeout(timer);
    timer = null;
  }

  // On page hide the tab may be gone before a fetch resolves, so hand the
  // last batch to sendBeacon, which the browser delivers on our behalf.
  if (useBeacon && navigator.sendBeacon) {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
        navigator.sendBeacon(
          `${url}/rest/v1/page_events?apikey=${encodeURIComponent(key)}`,
          blob,
        );
        return;
      } catch {
        /* fall through to the normal path */
      }
    }
  }

  try {
    await getSupabase()?.from('page_events').insert(batch);
  } catch {
    // Swallowed on purpose. A failed measurement must never surface to a
    // reader, and must never take a form submission down with it.
  }
}

export function track(name: EventName, props: Record<string, unknown> = {}) {
  if (!enabled) return;
  const visitor = visitorId();
  if (!visitor) return;

  queue.push({
    name,
    path: window.location.pathname,
    referrer: referringHost(),
    visitor,
    device: device(),
    props,
  });

  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (timer === null) {
    timer = window.setTimeout(() => void flush(), FLUSH_MS);
  }
}

/** The id the forms attach to a lead, so a lead can be attributed. */
export function currentVisitor(): string | null {
  return enabled ? visitorId() : null;
}

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  if (!isConfigured || optedOut()) return;
  enabled = true;

  track('pageview');

  // ── Scroll depth ────────────────────────────────────────────────
  // Thresholds rather than a continuous value: "how far do people get"
  // is answered by four numbers, and a row per scroll event would be a
  // row per frame.
  const marks = [25, 50, 75, 90];
  const seen = new Set<number>();
  let ticking = false;

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = (window.scrollY / max) * 100;
      for (const m of marks) {
        if (pct >= m && !seen.has(m)) {
          seen.add(m);
          track('scroll_depth', { percent: m });
        }
      }
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanup.push(() => window.removeEventListener('scroll', onScroll));

  // ── Outbound clicks ─────────────────────────────────────────────
  // Host only, and only genuinely external ones. The credits rows and
  // the case-study source links are the interesting case: knowing the
  // work is being clicked through to is a signal about the work.
  const onClick = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    try {
      const url = new URL(href, window.location.href);
      if (url.host && url.host !== window.location.host) {
        track('outbound_click', { host: url.host });
      }
    } catch {
      /* not a URL we can parse; nothing to record */
    }
  };
  document.addEventListener('click', onClick, { capture: true, passive: true });
  cleanup.push(() =>
    document.removeEventListener('click', onClick, { capture: true } as EventListenerOptions),
  );

  // ── Form engagement ─────────────────────────────────────────────
  // First interaction only. The gap between form_start and form_submit
  // is the abandonment rate, which is the number worth having.
  const forms = Array.from(
    document.querySelectorAll<HTMLFormElement>('[data-contact-form], [data-estimate-form]'),
  );
  forms.forEach((form) => {
    let started = false;
    const onInput = () => {
      if (started) return;
      started = true;
      track('form_start', {
        form: form.hasAttribute('data-estimate-form') ? 'estimate' : 'contact',
      });
    };
    form.addEventListener('input', onInput, { once: true, passive: true });
    cleanup.push(() => form.removeEventListener('input', onInput));
  });

  // ── Flush on the way out ────────────────────────────────────────
  // `pagehide` rather than `unload`, which is unreliable on mobile and
  // blocks the back/forward cache.
  const onHide = () => void flush(true);
  window.addEventListener('pagehide', onHide);
  cleanup.push(() => window.removeEventListener('pagehide', onHide));

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush(true);
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanup.push(() => document.removeEventListener('visibilitychange', onVisibility));
}

export function destroyAnalytics() {
  void flush(true);
  cleanup.forEach((fn) => fn());
  cleanup = [];
  enabled = false;
}
