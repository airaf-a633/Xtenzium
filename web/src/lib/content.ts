import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_UNVERIFIED } from './placeholder';

export type WorkEntry = CollectionEntry<'work'>;

/**
 * Whether a number is allowed on a production page.
 *
 * `measured` and `observed` both stand on their own — one was taken after
 * launch and agreed, the other is true by inspecting the thing. Anything
 * still marked `unverified` shows in development so the layout can be
 * reviewed, and is stripped from the build, the same rule
 * `unverified()` applies to every other unchecked claim on the site.
 */
export function publishable(c: { basis: 'measured' | 'observed' | 'unverified' }) {
  return c.basis !== 'unverified' || SHOW_UNVERIFIED;
}

/**
 * Case studies, newest-intent first.
 *
 * Drafts render in development so the design can be reviewed, and are
 * stripped from production builds. That makes it impossible to ship a
 * placeholder entry by forgetting to delete it.
 */
export async function getWork(): Promise<WorkEntry[]> {
  const entries = await getCollection('work', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true,
  );
  return entries.sort((a, b) => a.data.order - b.data.order);
}
