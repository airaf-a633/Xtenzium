import { createClient } from '@supabase/supabase-js';

/**
 * Journal posts, fetched at BUILD time.
 *
 * The whole point of a journal here is topical authority, which means the
 * words have to be in the HTML a crawler receives. Fetching in the browser
 * would leave every post invisible to search — so posts are pulled during
 * `astro build` and baked into static pages.
 *
 * Consequence worth knowing: publishing in the admin does not update the
 * live site until a rebuild runs. Wire a Supabase webhook on `blogs` to a
 * Vercel deploy hook and that becomes automatic.
 *
 * Reads use the anon key against `blogs_public_select`, which is already
 * scoped to `status = 'published'` — drafts are invisible to this code by
 * database policy, not by a filter we could forget to write. The explicit
 * `.eq('status', 'published')` below is belt and braces.
 */

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  cover_image: string | null;
  category: string | null;
  tags: string[];
  published_at: string | null;
  created_at: string;
}

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const blogConfigured = Boolean(url && anonKey);

/**
 * Never throws. A missing key or an unreachable database yields an empty
 * journal and an honest empty state — a marketing build should not fail
 * because a content service is down.
 */
export async function getPosts(): Promise<BlogPost[]> {
  if (!url || !anonKey) {
    console.warn('[journal] Supabase not configured — building an empty journal.');
    return [];
  }

  try {
    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb
      .from('blogs')
      .select('id, title, slug, excerpt, content, cover_image, category, tags, published_at, created_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[journal] fetch failed, building an empty journal:', error.message);
      return [];
    }
    return (data ?? []) as BlogPost[];
  } catch (err) {
    console.warn('[journal] unreachable, building an empty journal:', err);
    return [];
  }
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug) ?? null;
}

export function postDate(post: BlogPost): string {
  const iso = post.published_at ?? post.created_at;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function postIso(post: BlogPost): string {
  return post.published_at ?? post.created_at;
}
