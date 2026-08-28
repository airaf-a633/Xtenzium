import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(SplitText, ScrollTrigger);

/**
 * Recipe 05 — masked line entrance for headings whose text is content.
 *
 * Markup contract:
 *
 *   <h1 data-split>{post.title}</h1>          — lines wipe up behind a mask
 *   <h2 data-split="words">{client}</h2>      — words wipe up, for short strings
 *
 * Why this exists next to data-reveal="line", rather than replacing it:
 *
 * A marketing heading is hand-wrapped. Somebody decided that "Why it
 * matters for / your business." breaks after "for", and that break is a
 * typographic decision — it survives every viewport because it was chosen,
 * not measured. Those headings keep data-reveal="line".
 *
 * A case-study client name or a post title is content. Its line breaks
 * cannot be authored because nobody knows the string until it is written,
 * so they have to be measured. That is the job SplitText does here, and
 * the only job it does — this module is deliberately not a sitewide
 * replacement for the hand-wrapped headings.
 *
 * The hero is also left alone. It already wipes its lines up from behind
 * overflow-hidden masks it builds in markup, which is exactly what
 * `mask: 'lines'` produces — running it through SplitText would add a
 * plugin to the critical path and change nothing on screen.
 */

const FULL = '(prefers-reduced-motion: no-preference)';

let mm: gsap.MatchMedia | null = null;

function alreadyInView(el: Element) {
  return el.getBoundingClientRect().top <= window.innerHeight * 0.96;
}

export function initSplit() {
  if (typeof window === 'undefined') return;

  const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-split]'));
  if (!targets.length) return;

  mm = gsap.matchMedia();

  // Under reduced motion the text is never split at all. Leaving the DOM
  // untouched is both the calmer result and the safer one: no generated
  // wrapper elements sitting between a screen reader and the heading.
  mm.add(FULL, () => {
    targets.forEach((el) => {
      // global.css sets `text-wrap: balance` on every heading. SplitText
      // measures line boxes to find the line breaks, and balance rewrites
      // those boxes as it measures — the two disagree and lines come out
      // split in the wrong places. Opt this element out before splitting.
      el.style.textWrap = 'wrap';

      const mode = el.dataset.split === 'words' ? 'words' : 'lines';

      SplitText.create(el, {
        type: mode,
        // The mask wrapper is what makes this a wipe rather than a fade:
        // each line gets its own clipping box to travel out from behind.
        mask: mode,
        // Keeps the original text on the element as an aria-label and
        // hides the generated pieces, so the heading is still announced
        // as one string instead of being spelled out line by line.
        aria: 'auto',
        // Re-splits when the webfont lands or the element changes width.
        // Without it, lines measured against the fallback font stay wrong
        // for the rest of the page's life.
        autoSplit: true,
        onSplit(self) {
          const pieces = mode === 'words' ? self.words : self.lines;

          // autoSplit re-runs this on every re-split, including the ones
          // caused by a resize. Replaying a heading the reader has already
          // watched arrive is the same mistake reveal.ts guards against,
          // so once it has played it only ever lands.
          if (el.dataset.splitPlayed !== undefined) {
            gsap.set(pieces, { yPercent: 0 });
            return;
          }

          return gsap.from(pieces, {
            yPercent: 115,
            duration: 0.85,
            stagger: mode === 'words' ? 0.045 : 0.09,
            // The closest built-in to the reference's [.16, 1, .3, 1],
            // and the same curve the hero lines use.
            ease: 'expo.out',
            onComplete: () => {
              el.dataset.splitPlayed = '';
            },
            ...(alreadyInView(el)
              ? {}
              : { scrollTrigger: { trigger: el, start: 'top 92%', once: true } }),
          });
        },
      });
    });
  });
}

export function destroySplit() {
  mm?.revert();
  mm = null;
}
