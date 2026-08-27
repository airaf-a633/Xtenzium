import gsap from 'gsap';
import { Observer } from 'gsap/Observer';

gsap.registerPlugin(Observer);

/**
 * Curved 3D coverflow.
 *
 * Cards are laid out absolutely and positioned entirely from a single
 * progress value, so there is one source of truth and no per-card
 * triggers. Every card derives its transform from its distance to the
 * focused index.
 *
 * The arc comes from pairing rotateY with a small y lift — rotation alone
 * reads as a flat fan rather than a curve.
 *
 * ── Two things changed here ────────────────────────────────────────
 *
 * It used to fade at 0.3 opacity per step out from centre, which means
 * anything more than three positions away was at zero. With nine
 * industries on the page that made the outer cards invisible rather than
 * distant — the reader saw a gap where four sectors should have been.
 * The falloff is gentler now and floors well above zero, so the whole set
 * reads as a set.
 *
 * And focus was scrubbed by scroll alone: the carousel moved when the
 * page moved and could not be touched. It is driven directly now —
 * dragged, clicked, arrowed, or stepped with the buttons. That last part
 * is not decoration: WCAG 2.2 requires a single-pointer alternative to
 * any drag operation, so the buttons and the arrow keys are the
 * accessible path and the drag is the pleasant one.
 *
 * Markup:
 *   <div data-coverflow>
 *     <div data-coverflow-stage>
 *       <article data-coverflow-card>…</article>
 *     </div>
 *     <button data-coverflow-prev> <button data-coverflow-next>
 *     <div data-coverflow-status role="status">
 *   </div>
 */

const SPREAD = 58; // % of card width between neighbours
const ROTATE = 24; // deg of rotateY per step out from centre
const LIFT = 22; // px of y drop per step — this is what curves it
const SCALE_STEP = 0.07;
const SCALE_MIN = 0.74;
const FADE_STEP = 0.14;
/** Far cards recede; they never disappear. */
const FADE_MIN = 0.34;

let mm: gsap.MatchMedia | null = null;

function apply(cards: HTMLElement[], focus: number) {
  cards.forEach((card, i) => {
    const d = i - focus; // signed distance from focus
    const a = Math.abs(d);
    gsap.set(card, {
      xPercent: -50 + d * SPREAD,
      yPercent: -50,
      y: a * LIFT,
      rotateY: -d * ROTATE,
      scale: Math.max(SCALE_MIN, 1 - a * SCALE_STEP),
      opacity: Math.max(FADE_MIN, 1 - a * FADE_STEP),
      zIndex: Math.round(100 - a * 10),
    });
    // Every card stays reachable. Hiding the unfocused ones from
    // assistive tech made eight of nine sectors unreadable, and a sector
    // list is content rather than chrome.
    card.classList.toggle('is-focused', a < 0.5);
  });
}

export function initCoverflow() {
  if (typeof window === 'undefined') return;

  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-coverflow]'));
  if (!roots.length) return;

  mm = gsap.matchMedia();

  // Reduced motion / small screens fall back to a plain scroll-snap row,
  // which the CSS already provides once this attribute is set.
  mm.add('(prefers-reduced-motion: reduce), (max-width: 767px)', () => {
    roots.forEach((root) => {
      root.setAttribute('data-coverflow-flat', '');
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      gsap.set(cards, { clearProps: 'all' });
      // The snap row is its own control; a pair of buttons that stepped a
      // focus index nothing is reading would be a lie.
      const controls = root.parentElement?.querySelector<HTMLElement>('[data-coverflow-controls]');
      if (controls) controls.hidden = true;
    });
    return () =>
      roots.forEach((r) => {
        r.removeAttribute('data-coverflow-flat');
        const c = r.parentElement?.querySelector<HTMLElement>('[data-coverflow-controls]');
        if (c) c.hidden = false;
      });
  });

  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    const cleanups: Array<() => void> = [];

    roots.forEach((root) => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      if (!cards.length) return;

      const last = cards.length - 1;
      const state = { focus: Math.round(last / 2) };
      // Controls sit beside the stage, not inside it — the stage is a
      // perspective container of absolutely positioned cards.
      const scope = root.parentElement ?? root;
      const status = scope.querySelector<HTMLElement>('[data-coverflow-status]');

      gsap.set(cards, { willChange: 'transform, opacity' });
      apply(cards, state.focus);

      const label = () => {
        const card = cards[Math.round(state.focus)];
        const name = card?.querySelector('[data-coverflow-label]')?.textContent?.trim();
        if (status && name) {
          status.textContent = `${Math.round(state.focus) + 1} of ${cards.length}: ${name}`;
        }
      };
      label();

      function goTo(next: number, immediate = false) {
        const target = gsap.utils.clamp(0, last, next);
        gsap.to(state, {
          focus: target,
          duration: immediate ? 0 : 0.55,
          ease: 'power3.out',
          overwrite: true,
          onUpdate: () => apply(cards, state.focus),
          onComplete: label,
        });
      }

      // ── Drag and swipe ──────────────────────────────────────────
      // Pointer and touch only. Claiming the wheel here would take the
      // page's own scroll away from the reader, which is a trade a
      // carousel never earns.
      const observer = Observer.create({
        target: root,
        type: 'touch,pointer',
        dragMinimum: 6,
        tolerance: 10,
        onDragStart: () => root.classList.add('is-dragging'),
        onDragEnd: () => root.classList.remove('is-dragging'),
        onLeft: () => goTo(Math.round(state.focus) + 1),
        onRight: () => goTo(Math.round(state.focus) - 1),
      });

      // ── Click a card to bring it forward ────────────────────────
      const onCardClick = (i: number) => () => goTo(i);
      const cardHandlers = cards.map((card, i) => {
        const h = onCardClick(i);
        card.addEventListener('click', h);
        return h;
      });

      // ── Keyboard ────────────────────────────────────────────────
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goTo(Math.round(state.focus) + 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goTo(Math.round(state.focus) - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          goTo(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          goTo(last);
        }
      };
      root.addEventListener('keydown', onKey);

      // ── Buttons — the required non-drag path ────────────────────
      const prev = scope.querySelector<HTMLButtonElement>('[data-coverflow-prev]');
      const next = scope.querySelector<HTMLButtonElement>('[data-coverflow-next]');
      const onPrev = () => goTo(Math.round(state.focus) - 1);
      const onNext = () => goTo(Math.round(state.focus) + 1);
      prev?.addEventListener('click', onPrev);
      next?.addEventListener('click', onNext);

      cleanups.push(() => {
        observer.kill();
        cards.forEach((c, i) => c.removeEventListener('click', cardHandlers[i]));
        root.removeEventListener('keydown', onKey);
        prev?.removeEventListener('click', onPrev);
        next?.removeEventListener('click', onNext);
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}

export function destroyCoverflow() {
  mm?.revert();
  mm = null;
}
