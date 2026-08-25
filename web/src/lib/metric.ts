/**
 * Build-time bridge between a metric string and the counter driver.
 *
 * Metric values in the content files are free-form on purpose — `41%`,
 * `140`, `11mo`, `99.4%`, `3.2s → 0.8s` all say something a bare number
 * cannot, and forcing authors to also hand-write a numeric twin would
 * guarantee the two drift apart the first time someone edits one.
 *
 * So the page derives the counter attributes from the string it is already
 * rendering. A value animates only when it is unambiguously one number
 * wearing a prefix and a suffix. Anything with a second number in it — a
 * before/after pair like `3.2s → 0.8s` — has no single value to count to,
 * so it renders as static text rather than counting to half of itself.
 */

/** One numeric run, and nothing numeric on either side of it. The
 *  non-digit character classes are what reject `3.2s → 0.8s`. */
const SINGLE_NUMBER = /^([^\d]*)(\d+(?:\.\d+)?)([^\d]*)$/;

export type CountAttrs = {
  'data-count-to': string;
  'data-count-prefix': string;
  'data-count-suffix': string;
};

/**
 * Returns attributes to spread onto the element, or `null` when the value
 * is not countable. `data-count-to` stays a string so the driver can read
 * the decimal places off it — `99.4` must land on `99.4`, not `99`.
 */
export function countAttrs(value: string): CountAttrs | null {
  const match = SINGLE_NUMBER.exec(value.trim());
  if (!match) return null;

  const [, prefix, number, suffix] = match;
  return {
    'data-count-to': number,
    'data-count-prefix': prefix,
    'data-count-suffix': suffix,
  };
}
