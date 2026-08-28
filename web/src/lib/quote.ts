import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Word-level reveal for pull quotes.
 *
 * The one place on the site where per-word animation earns its cost: a
 * testimonial is a single large sentence, and revealing it word by word
 * makes it read at the pace it would be spoken.
 *
 * The words are split from `textContent`, so the quote stays plain text in
 * the HTML for crawlers and for anyone with JS off. Each word is wrapped in
 * an inline-block span — `overflow: clip` on the parent would break
 * descenders here, so this fades and lifts rather than masking.
 */

const REDUCED = '(prefers-reduced-motion: reduce)';

let ctx: gsap.Context | null = null;

export function initQuotes() {
  if (typeof window === 'undefined') return;

  const quotes = Array.from(document.querySelectorAll<HTMLElement>('[data-quote]'));
  if (!quotes.length) return;

  if (window.matchMedia(REDUCED).matches) {
    gsap.set(quotes, { opacity: 1 });
    return;
  }

  ctx = gsap.context(() => {
    quotes.forEach((quote) => {
      const text = quote.textContent?.trim() ?? '';
      if (!text) return;

      quote.textContent = '';
      const words = text.split(/\s+/).map((word) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.display = 'inline-block';
        span.style.willChange = 'transform, opacity';
        quote.appendChild(span);
        quote.appendChild(document.createTextNode(' '));
        return span;
      });

      gsap.set(words, { opacity: 0, y: '0.4em' });
      gsap.to(words, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        stagger: 0.028,
        ease: 'power2.out',
        scrollTrigger: { trigger: quote, start: 'top 82%', once: true },
      });
    });
  });
}

export function destroyQuotes() {
  ctx?.revert();
  ctx = null;
}
