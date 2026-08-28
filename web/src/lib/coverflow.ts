import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Observer } from 'gsap/Observer';

gsap.registerPlugin(ScrollTrigger, Observer);

/**
 * Infinite 3D coverflow.
 *
 * Cards sit on a curve — rotateY paired with a small y lift, because
 * rotation alone reads as a flat fan rather than an arc — and the curve
 * never ends. Position comes from one number and every card derives its
 * own transform from its distance to centre.
 *
 * ── What was wrong before ──────────────────────────────────────────
 *
 * The arc was finite: focus ran 0 to 8 and the cards at the ends sat at
 * whatever the fade left them. With a linear falloff of 0.3 per step,
 * anything beyond three positions was at zero opacity, so a third of the
 * sectors were invisible — and the ones that were visible collided,
 * because nine cards on a fixed arc overlap whatever is in the middle.
 *
 * Making it infinite fixes both, and it fixes them for the same reason.
 * Distance to centre is now computed through a wrap:
 *
 *   d = wrap(-n/2, n/2, i - focus)
 *
 * so a card leaving the right of the arc re-enters from the left rather
 * than piling up at an end. Nothing has to be crammed into one viewport,
 * because the set is always flowing through rather than laid out at once.
 *
 * And the fade now has a job. It is not a decoration that happens to
 * delete content: it reaches zero exactly at the wrap boundary, which is
 * the one frame where a card teleports from one side to the other. The
 * card is invisible precisely when it needs to be, and fully legible
 * everywhere the reader is actually looking.
 *
 * `focus` is written by two things that must not fight: ScrollTrigger
 * scrubs it while the section passes, and Observer adds to it when the
 * reader drags. Both only ever add to the same number, so drag wins while
 * it happens and scroll resumes from wherever drag left it.
 */

// Spread is the one number that decides whether cards merge. At 56% of a
// card width between neighbours, every card covered 44% of the one behind
// it — and since the label sits at the bottom-left, the card in front
// landed exactly on top of the words. Past ~70% the faces stop touching.
const SPREAD = 96; // % of card width between neighbours
// Rotation is the other half of the same problem. At 22deg per step a card
// four out sits ~88deg from the viewer: edge-on, 86px wide, a sliver. 15
// keeps the arc readable across the whole set.
const ROTATE = 15; // deg of rotateY per step out from centre
const LIFT = 18; // px of y drop per step — this is what curves it
const SCALE_STEP = 0.05;
const SCALE_MIN = 0.78;
/** Steps of runway over which a card fades out before it wraps. */
const FADE_SPAN = 1.7;

let mm: gsap.MatchMedia | null = null;

function apply(cards: HTMLElement[], focus: number) {
  const n = cards.length;
  const edge = n / 2;
  const wrapD = gsap.utils.wrap(-edge, edge);

  cards.forEach((card, i) => {
    const d = wrapD(i - focus); // signed distance, through the loop
    const a = Math.abs(d);

    // Full opacity until the last stretch, then out by the wrap point.
    const fade = a <= edge - FADE_SPAN ? 1 : Math.max(0, (edge - a) / FADE_SPAN);

    gsap.set(card, {
      xPercent: -50 + d * SPREAD,
      yPercent: -50,
      y: a * LIFT,
      rotateY: -d * ROTATE,
      scale: Math.max(SCALE_MIN, 1 - a * SCALE_STEP),
      opacity: fade,
      zIndex: Math.round(100 - a * 10),
      pointerEvents: fade > 0.5 ? 'auto' : 'none',
    });
    card.classList.toggle('is-focused', a < 0.5);
  });
}

export function initCoverflow() {
  if (typeof window === 'undefined') return;

  const roots = Array.from(document.querySelectorAll<HTMLElement>('[data-coverflow]'));
  if (!roots.length) return;

  mm = gsap.matchMedia();

  // Reduced motion: a plain scroll-snap row. Nothing moves that the reader
  // did not move themselves.
  mm.add('(prefers-reduced-motion: reduce)', () => {
    roots.forEach((root) => {
      root.setAttribute('data-coverflow-flat', '');
      gsap.set(root.querySelectorAll('[data-coverflow-card]'), { clearProps: 'all' });
      const c = root.parentElement?.querySelector<HTMLElement>('[data-coverflow-controls]');
      if (c) c.hidden = true;
    });
    return () =>
      roots.forEach((r) => {
        r.removeAttribute('data-coverflow-flat');
        const c = r.parentElement?.querySelector<HTMLElement>('[data-coverflow-controls]');
        if (c) c.hidden = false;
      });
  });

  // Mobile: a real scroller that the page also moves.
  //
  // The first attempt drove the row with a transform, which meant native
  // overflow had to be switched off so the two were not fighting for the
  // same axis — and that took the swipe away. A row of cards that cannot
  // be pushed with a thumb is broken on a phone regardless of what else
  // it does.
  //
  // Driving `scrollLeft` instead keeps it an ordinary scroller. Swipe
  // works because nothing was taken away; scroll works because the page
  // writes the same property the thumb does. When both want it at once
  // the thumb wins, which is the only defensible way round: the reader's
  // gesture is deliberate and the scroll position is ambient.
  mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
    const kills: Array<() => void> = [];

    roots.forEach((root) => {
      root.setAttribute('data-coverflow-flat', '');
      // Mandatory snap rewrites every programmatic scrollLeft to the
      // nearest card, so a row driven by the page snaps from card to card
      // instead of gliding. Snap is switched off while the page is
      // driving; the swipe does not need it to feel right, and the
      // reduced-motion branch keeps it.
      root.setAttribute('data-coverflow-driven', '');
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      if (!cards.length) return;
      gsap.set(cards, { clearProps: 'all' });

      // Touching the row hands control over for as long as the gesture
      // lasts, plus a moment after so momentum can settle.
      let held = false;
      let releaseAt = 0;
      const hold = () => {
        held = true;
        releaseAt = 0;
      };
      const release = () => {
        held = false;
        releaseAt = performance.now() + 900;
      };
      root.addEventListener('pointerdown', hold, { passive: true });
      root.addEventListener('touchstart', hold, { passive: true });
      root.addEventListener('pointerup', release, { passive: true });
      root.addEventListener('touchend', release, { passive: true });
      root.addEventListener('pointercancel', release, { passive: true });

      const max = () => Math.max(0, root.scrollWidth - root.clientWidth);

      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (held || performance.now() < releaseAt) return;
          root.scrollLeft = self.progress * max();
        },
      });

      const controls = root.parentElement?.querySelector<HTMLElement>('[data-coverflow-controls]');
      if (controls) controls.hidden = true;

      kills.push(() => {
        st.kill();
        root.removeEventListener('pointerdown', hold);
        root.removeEventListener('touchstart', hold);
        root.removeEventListener('pointerup', release);
        root.removeEventListener('touchend', release);
        root.removeEventListener('pointercancel', release);
        root.removeAttribute('data-coverflow-flat');
        root.removeAttribute('data-coverflow-driven');
        if (controls) controls.hidden = false;
      });
    });

    return () => kills.forEach((fn) => fn());
  });

  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    const cleanups: Array<() => void> = [];

    roots.forEach((root) => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-coverflow-card]'));
      if (!cards.length) return;

      const scope = root.parentElement ?? root;
      const status = scope.querySelector<HTMLElement>('[data-coverflow-status]');
      const state = { focus: 0 };
      const wrapIndex = gsap.utils.wrap(0, cards.length);

      gsap.set(cards, { willChange: 'transform, opacity' });
      apply(cards, state.focus);

      const label = () => {
        const i = wrapIndex(Math.round(state.focus));
        const name = cards[i]?.querySelector('[data-coverflow-label]')?.textContent?.trim();
        if (status && name) status.textContent = `${i + 1} of ${cards.length}: ${name}`;
      };
      label();

      const draw = () => apply(cards, state.focus);

      // ── Scroll drives it ────────────────────────────────────────
      // Scrubbed, so the rail is a function of where the reader is on
      // the page and scrolling back rewinds it. One full pass of the
      // section moves the arc by roughly the whole set.
      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          state.focus = self.progress * cards.length;
          draw();
        },
      });

      // ── Drag adds to the same number ────────────────────────────
      const observer = Observer.create({
        target: root,
        type: 'touch,pointer',
        dragMinimum: 4,
        onPress: () => root.classList.add('is-dragging'),
        onRelease: () => {
          root.classList.remove('is-dragging');
          label();
        },
        onDrag: (self) => {
          // One card per ~220px of travel keeps the arc from spinning.
          state.focus -= self.deltaX / 220;
          draw();
        },
      });

      // ── Buttons and keys ────────────────────────────────────────
      // WCAG 2.2 requires a single-pointer alternative to any
      // author-controlled drag, so these are the accessible path.
      const step = (dir: number) =>
        gsap.to(state, {
          focus: state.focus + dir,
          duration: 0.5,
          ease: 'power3.out',
          overwrite: true,
          onUpdate: draw,
          onComplete: label,
        });

      const prev = scope.querySelector<HTMLButtonElement>('[data-coverflow-prev]');
      const next = scope.querySelector<HTMLButtonElement>('[data-coverflow-next]');
      const onPrev = () => step(-1);
      const onNext = () => step(1);
      prev?.addEventListener('click', onPrev);
      next?.addEventListener('click', onNext);

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          step(-1);
        }
      };
      root.addEventListener('keydown', onKey);

      cleanups.push(() => {
        st.kill();
        observer.kill();
        prev?.removeEventListener('click', onPrev);
        next?.removeEventListener('click', onNext);
        root.removeEventListener('keydown', onKey);
        gsap.set(cards, { clearProps: 'all' });
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });
}

export function destroyCoverflow() {
  mm?.revert();
  mm = null;
}
