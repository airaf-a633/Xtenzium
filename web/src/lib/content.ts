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

  // Markdown passes `<!-- -->` through to the rendered HTML, so working
  // notes left in a study body — what is still unwritten, which number
  // needs a client's sign-off — ship in the page source of the published
  // page and are readable by anyone who opens view-source. The page looks
  // perfect, which is exactly why nobody catches it.
  //
  // Drafts are free to carry notes; that is what a draft is for. Anything
  // that has been published must not, and this fails the build rather
  // than trusting whoever flipped the flag to have remembered.
  // Checked against `draft` rather than against the filtered list, so the
  // rule behaves identically in development and in the build instead of
  // only biting after deploy.
  const leaking = entries.filter((e) => !e.data.draft && e.body?.includes('<!--'));
  if (leaking.length) {
    throw new Error(
      `Published case ${leaking.length > 1 ? 'studies' : 'study'} still ` +
        `carrying working notes in the body: ${leaking.map((e) => e.id).join(', ')}. ` +
        `An HTML comment in markdown is rendered into the page source. ` +
        `Move the note into the frontmatter as a YAML comment, which is not.`,
    );
  }

  return entries.sort((a, b) => a.data.order - b.data.order);
}
