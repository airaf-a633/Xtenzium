/**
 * Emits a journal post as SQL.
 *
 * Journal posts live in Supabase `blogs`, not in the repo — lib/blog.ts
 * pulls them at build time so the words are in the HTML a crawler
 * receives. There is no file-based authoring path, so a post written here
 * has to arrive as an insert.
 *
 * Content is ProseMirror/TipTap JSON, the shape lib/tiptap.ts renders.
 * Hand-writing that JSON inline is unreadable, so it is composed with
 * small helpers and serialised.
 *
 *   node scripts/make-post.mjs > ../supabase/seed/001_post_brief_checklist.sql
 */

const t = (text, marks) => (marks ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...content) => ({ type: 'paragraph', content });
const h = (level, text) => ({ type: 'heading', attrs: { level }, content: [t(text)] });
const li = (...content) => ({ type: 'listItem', content: [p(...content)] });
const ul = (...items) => ({ type: 'bulletList', content: items });
const B = [{ type: 'bold' }];

const doc = {
  type: 'doc',
  content: [
    p(
      t(
        'Most briefs arrive as a solution. “We need a new website.” “We need an app.” By the time an agency hears that, a decision has already been made, and often it is the wrong one — not because the client was careless, but because the thing that is actually broken sits one level below the thing that is easy to name.',
      ),
    ),
    p(
      t(
        'This is what we ask for before quoting anything. None of it is hard to gather, and having it turns a scoping call from discovery into a decision. It is worth having even if you never speak to us: any agency worth hiring wants the same, and one that does not ask is one that intends to bill you for finding out later.',
      ),
    ),

    h(2, '1. What is actually going wrong'),
    p(
      t(
        'Not the feature you want. The thing costing you money or time right now, in one paragraph, in the words you would use to a colleague.',
      ),
    ),
    p(
      t('A good version reads like: '),
      t(
        '“Our ops team re-keys every order into two systems and we lose about a day a week to it.”',
        B,
      ),
      t(
        ' A weak version reads like: “We need a dashboard.” The first has a cost attached and admits several possible solutions. The second has already chosen one, and may have chosen wrong.',
      ),
    ),

    h(2, '2. How the work is done today'),
    p(
      t(
        'Including the parts that are in no documentation. The documented process and the real one are rarely the same, and the gap between them is where most projects quietly fail — a build against the documented version ships something nobody can actually use.',
      ),
    ),
    p(
      t(
        'A screenshot of the spreadsheet somebody maintains privately is worth more here than a process diagram.',
      ),
    ),

    h(2, '3. Who has to use it, and under what conditions'),
    ul(
      li(t('How many people, in which roles.')),
      li(
        t(
          'On what hardware. A warehouse tablet operated with gloves on is a different product from a desk with two monitors.',
        ),
      ),
      li(
        t(
          'What their tolerance for change is. A team that has survived two failed rollouts will not forgive a third.',
        ),
      ),
    ),

    h(2, '4. What already exists'),
    p(
      t(
        'Repositories, hosting, domains, analytics, the CRM, the half-finished thing from two years ago. It does not need to be tidy. It needs to be listed, because the most expensive discovery on any project is the system nobody mentioned that turns out to be load-bearing.',
      ),
    ),
    p(
      t(
        'If you do not know who controls the domain or where the code lives, write that down too. That is a finding, and a common one.',
      ),
    ),

    h(2, '5. The constraint that decides everything'),
    p(
      t(
        'Every project has one thing that is not negotiable, and naming it early saves weeks. Usually it is a date tied to something external, a compliance requirement, a budget ceiling, an integration that must keep working, or a person who has to approve.',
      ),
    ),
    p(
      t(
        'Tell an agency the real constraint and a good one designs around it. Hide it and you get a proposal that has to be rebuilt the moment it surfaces.',
      ),
    ),

    h(2, '6. What “done” looks like'),
    p(t('Finish this sentence: '), t('“Six months after launch, we will know this worked because…”', B)),
    p(
      t(
        'If the answer is “it looks better”, the project has no success condition and cannot be judged — which means scope can only grow. If the answer is “the ops team stopped re-keying orders”, it can be judged, and every proposed feature can be argued against it.',
      ),
    ),

    h(2, '7. Your budget range'),
    p(t('Not a number you are hiding. A range you can act on.')),
    p(
      t(
        'Withholding budget is understandable and it costs you. An agency that does not know the range proposes either the largest defensible version or the cheapest, and both waste a round. Given a range, a good agency tells you honestly whether it is enough and what it buys. Sometimes the answer is that you need a smaller piece of work than you thought.',
      ),
    ),

    h(2, 'What this gets you'),
    p(
      t(
        'With those seven, the first conversation stops being discovery and becomes a decision. You should leave it with a written scope and a number — and you should keep both whether or not you hire the agency that wrote them.',
      ),
    ),
    p(
      t('If that is useful, our '),
      t('estimator', [{ type: 'link', attrs: { href: '/estimate' } }]),
      t(
        ' gives a realistic range from four questions, and asks for nothing until after it has shown you the number.',
      ),
    ),
  ],
};

const post = {
  title: 'What to have ready before you brief an agency',
  slug: 'brief-an-agency-checklist',
  excerpt:
    'Seven things that turn a scoping call from discovery into a decision. None are hard to gather, and any agency worth hiring will ask for the same.',
  category: 'Practice',
  tags: ['scoping', 'working with agencies', 'delivery'],
};

/** Postgres literal quoting — doubles any single quote. */
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const arr = `ARRAY[${post.tags.map(q).join(', ')}]::text[]`;

process.stdout.write(`-- Journal post: ${post.title}
--
-- Journal posts live in Supabase rather than in the repo, so a post
-- written in the codebase has to arrive as an insert. Generated by
-- scripts/make-post.mjs; edit that and regenerate rather than editing
-- this by hand.
--
-- Idempotent on slug, so running it twice updates rather than duplicates.

insert into public.blogs (title, slug, excerpt, content, category, tags, status, published_at)
values (
  ${q(post.title)},
  ${q(post.slug)},
  ${q(post.excerpt)},
  ${q(JSON.stringify(doc))}::jsonb,
  ${q(post.category)},
  ${arr},
  'published',
  now()
)
on conflict (slug) do update set
  title        = excluded.title,
  excerpt      = excluded.excerpt,
  content      = excluded.content,
  category     = excluded.category,
  tags         = excluded.tags,
  status       = excluded.status,
  updated_at   = now();
`);
