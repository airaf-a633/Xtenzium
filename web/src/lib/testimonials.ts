import { createClient } from '@supabase/supabase-js';

/**
 * Client testimonials, fetched at BUILD time.
 *
 * Same shape as `blog.ts`, and for the same reason: a quote fetched in
 * the browser is invisible to a crawler, and social proof that only
 * appears after hydration is social proof a search result never shows.
 *
 * Consequence worth knowing: adding a testimonial in the CRM does not
 * change the live site until a rebuild runs. The Supabase webhook →
 * Vercel deploy hook that the journal wants covers this table too.
 *
 * Reads use the anon key against `testimonials_public_select`, which is
 * scoped to `status = 'published' and consent = true`. Drafts and
 * unconsented quotes are invisible to this code by database policy
 * rather than by a filter we could forget to write.
 */

export type Placement = 'home' | 'work' | 'estimate';

export interface Testimonial {
  id: string;
  quote: string;
  author_name: string | null;
  author_role: string | null;
  company: string | null;
  project: string | null;
  placement: 'any' | Placement;
  sort_order: number;
}

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/**
 * Never throws. A missing key or an unreachable database yields no
 * quotes and the sections simply do not render — a marketing build
 * should not fail because a content service is down, and an absent
 * testimonial costs nothing next to a broken deploy.
 */
export async function getTestimonials(): Promise<Testimonial[]> {
  if (!url || !anonKey) return [];

  try {
    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb
      .from('testimonials')
      .select('id, quote, author_name, author_role, company, project, placement, sort_order')
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.warn('[testimonials] fetch failed, rendering none:', error.message);
      return [];
    }
    return (data ?? []) as Testimonial[];
  } catch (err) {
    console.warn('[testimonials] unreachable, rendering none:', err);
    return [];
  }
}

/**
 * The one quote a given page should show.
 *
 * Prefers a quote written for that page, falls back to a general one,
 * and returns null rather than repeating another page's. Deterministic
 * by design — a rotating quote would mean the same URL rendering
 * differently on consecutive builds, which is a diff nobody can read.
 */
export function pickTestimonial(all: Testimonial[], placement: Placement): Testimonial | null {
  return all.find((t) => t.placement === placement) ?? all.find((t) => t.placement === 'any') ?? null;
}

/**
 * "Operations Director, Acme" from whichever parts were consented to.
 *
 * Falls back to "Client" rather than an empty line: a quote with no
 * attribution at all reads as invented, which is exactly the impression
 * this whole system exists to avoid.
 */
export function attributionOf(t: Testimonial): { attribution: string; role?: string } {
  const attribution = t.author_name ?? t.author_role ?? 'Client';
  const rest = [t.author_name ? t.author_role : null, t.company].filter(Boolean).join(', ');
  return { attribution, role: rest || undefined };
}
