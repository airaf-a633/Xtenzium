/**
 * Safety catch for content that has not been verified yet.
 *
 * Same principle as `draft: true` on a case study: anything routed through
 * here renders in development so the design can be reviewed, and is stripped
 * from production builds. It makes shipping invented numbers or attributed
 * quotes an explicit act rather than something you forget to undo.
 *
 * Use it for anything a reader would reasonably take as fact:
 *   - prices and price bands
 *   - client quotes and their attributions
 *   - counts, percentages, and outcome claims
 *
 * To publish, replace the value with the real one and drop the wrapper.
 * Do not flip a global switch — the point is that each claim gets checked.
 */

/** True only in development. */
export const SHOW_UNVERIFIED = import.meta.env.DEV;

/**
 * Returns the value in development, `null` in production.
 * Render with `{unverified(x) && ...}` so the whole block disappears.
 */
export function unverified<T>(value: T): T | null {
  return SHOW_UNVERIFIED ? value : null;
}
