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
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    client: z.string(),
    title: z.string(),
    sector: z.string(),
    year: z.number(),
    summary: z.string(),
    services: z.array(z.string()),
    stack: z.array(z.string()).default([]),
    // The single number that leads the card.
    headline: z.object({ value: z.string(), label: z.string() }),
    // Supporting numbers on the detail page.
    metrics: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
