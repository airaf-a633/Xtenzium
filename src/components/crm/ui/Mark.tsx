/* The Xtenzium mark (V4) — the same geometry the marketing site's
   favicon uses, so the CRM is visibly the same company rather than a
   letter in a box.

   Rendered in a single `currentColor` rather than the brand's two
   copper tones. At the 16–22px it appears at here, two tones of copper
   sitting on a copper chip read as mud; a clean knockout reads as a
   mark. The two-tone version survives where it has room — the favicon. */

export const Mark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6,24 L19.5,15 L19.5,27 L6,36 Z" />
    <path d="M6,24 L19.5,15 L19.5,27 L6,36 Z" transform="rotate(180 20 20)" />
    <path d="M6,4 L19.5,13 L19.5,25 L6,16 Z" />
    <path d="M6,4 L19.5,13 L19.5,25 L6,16 Z" transform="rotate(180 20 20)" />
  </svg>
);
