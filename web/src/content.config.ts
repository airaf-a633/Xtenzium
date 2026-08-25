import { defineCollection } from 'astro:content';
import { z } from 'astro:schema';
import { glob } from 'astro/loaders';

/**
 * Case studies.
 *
 * `draft` is a safety catch, not a convenience. Anything marked draft is
 * filtered out of production builds, so placeholder or unapproved work
 * cannot reach the live site by accident. Flip it to false only once the
 * numbers in the entry are real and the client has agreed to be named.
 */

/**
 * A number on a card, and where it came from.
 *
 * /work promises the reader "numbers we can defend" and case studies that
 * report "what it returned, measured after launch, not projected before
 * it". That promise is only worth anything if it is enforced somewhere,
 * so every number carries its own provenance:
 *
 *   measured   Taken after launch and agreed with the client. The only
 *              basis allowed to make a performance claim.
 *   observed   True by inspecting the thing itself — lines of PL/pgSQL,
 *              number of surfaces, vehicles instrumented. Not a claim
 *              about outcomes, so it needs no client sign-off, and it
 *              lets real work publish before the ROI conversation
 *              happens.
 *   unverified Not yet confirmed. Renders in development and is stripped
 *              from production, exactly like `unverified()` in
 *              lib/placeholder.ts.
 *
 * The default is `unverified` on purpose: publishing a number has to be a
 * deliberate act, never something that happens because a field was left
 * blank.
 */
const claim = z.object({
  value: z.string(),
  label: z.string(),
  basis: z.enum(['measured', 'observed', 'unverified']).default('unverified'),
});

/**
 * Who delivered it, and what our part actually was.
 *
 * Most of the earlier work was built under another studio's banner. A
 * portfolio that lists those projects without saying so is claiming
 * ownership by omission, which is the thing a logo wall does and the
 * reason /work says it does not run one. Stating the contribution is what
 * separates a credit from a claim.
 *
 * Absent both fields, an entry reads as Xtenzium's own work end to end —
 * so leave them off only when that is true.
 */
const attribution = {
  /** The studio it shipped under, when that was not Xtenzium. */
  deliveredUnder: z.string().optional(),
  /** Our scope on it, in the reader's words rather than ours. */
  contribution: z.string().optional(),
};

const base = {
  /** Leads the card: a product name, or the client's name. */
  name: z.string(),
  title: z.string(),
  sector: z.string(),
  year: z.number(),
  summary: z.string(),
  services: z.array(z.string()),
  stack: z.array(z.string()).default([]),
  /** The single number that leads the card. */
  headline: claim,
  /** Supporting numbers on the detail page. */
  metrics: z.array(claim).default([]),
  order: z.number().default(0),
  draft: z.boolean().default(false),
  ...attribution,
};

/**
 * Two kinds of entry, because they are not the same story.
 *
 * `engagement` is work done for a client: somebody briefed us, we
 * decided things, something went wrong, and a number moved afterwards.
 * That is the shape /work advertises, so `client` is required — an
 * engagement nobody will let us name is not publishable.
 *
 * `product` is software we own. There is no brief and no client, so
 * writing one up in the engagement's voice would mean inventing a
 * relationship that never existed. It keeps the same four body sections
 * — the problem, what we decided, what went wrong, where it is now — but
 * it is honest about there being no client on the other end of them.
 */
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('engagement'),
      client: z.string(),
      ...base,
    }),
    z.object({
      kind: z.literal('product'),
      ...base,
    }),
  ]),
});

export const collections = { work };
