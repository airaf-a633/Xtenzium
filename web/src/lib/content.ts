import { getCollection, type CollectionEntry } from 'astro:content';

export type WorkEntry = CollectionEntry<'work'>;

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
