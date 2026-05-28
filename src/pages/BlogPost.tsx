import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link as TiptapLink from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { supabase } from '../lib/supabase';
import type { Blog } from '../types/database';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('blogs')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(({ data }) => {
        if (!data) {
          setNotFound(true);
        } else {
          setPost(data);
          try {
            const rendered = generateHTML(data.content as Parameters<typeof generateHTML>[0], [
              StarterKit,
              TiptapLink,
              Image,
              Typography,
            ]);
            setHtml(rendered);
          } catch {
            setHtml('<p>Could not render content.</p>');
          }
        }
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: 120, textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}>
        Loading…
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div style={{ minHeight: '100vh', paddingTop: 120, textAlign: 'center', background: 'var(--bg-primary)' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '2rem', marginBottom: 16 }}>Post not found</h1>
        <Link to="/blogs" style={{ color: 'var(--accent-blue)', textDecoration: 'none' }}>← Back to blog</Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingTop: 80 }}>
      {/* Cover */}
      {post.cover_image && (
        <div style={{ width: '100%', height: 'clamp(280px, 40vh, 500px)', overflow: 'hidden', position: 'relative' }}>
          <img
            src={post.cover_image}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, var(--bg-primary))' }} />
        </div>
      )}

      {/* Content container */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '48px 24px 80px' }}>
        {/* Breadcrumb */}
        <Link
          to="/blogs"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 32 }}
        >
          ← All posts
        </Link>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {post.category && (
            <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(41,121,255,0.12)', color: '#2979FF', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {post.category}
            </span>
          )}
          {post.published_at && (
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)',
          fontSize: 'clamp(2rem, 5vw, 3.25rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: -1.5,
          marginBottom: post.excerpt ? 20 : 40,
        }}>
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: 1.7, marginBottom: 40, fontStyle: 'italic', borderLeft: '3px solid var(--accent-blue)', paddingLeft: 20 }}>
            {post.excerpt}
          </p>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 48 }}>
            {post.tags.map(tag => (
              <span key={tag} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontSize: 12 }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div
          className="blog-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Footer */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid var(--border-divider)' }}>
          <Link
            to="/blogs"
            style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontWeight: 600, fontSize: 15 }}
          >
            ← Back to all posts
          </Link>
        </div>
      </div>

      <style>{`
        .blog-body > * + * { margin-top: 1em; }
        .blog-body h1 { font-family: var(--font-heading); color: var(--text-primary); font-size: 2.25em; font-weight: 800; line-height: 1.2; letter-spacing: -0.5px; margin-top: 1.5em; }
        .blog-body h2 { font-family: var(--font-heading); color: var(--text-primary); font-size: 1.6em; font-weight: 700; line-height: 1.3; margin-top: 1.5em; }
        .blog-body h3 { font-family: var(--font-heading); color: var(--text-primary); font-size: 1.25em; font-weight: 700; margin-top: 1.25em; }
        .blog-body p { color: var(--text-secondary); font-size: 1.0625rem; line-height: 1.8; }
        .blog-body strong { color: var(--text-primary); }
        .blog-body em { color: var(--text-secondary); }
        .blog-body a { color: var(--accent-blue); text-decoration: underline; }
        .blog-body ul, .blog-body ol { color: var(--text-secondary); padding-left: 1.5rem; line-height: 1.8; font-size: 1.0625rem; }
        .blog-body li { margin: 6px 0; }
        .blog-body blockquote { border-left: 3px solid var(--accent-blue); padding: 12px 20px; margin: 24px 0; background: rgba(41,121,255,0.04); border-radius: 0 8px 8px 0; }
        .blog-body blockquote p { color: var(--text-secondary); font-style: italic; }
        .blog-body code { background: rgba(255,255,255,0.06); color: #e2a0ff; padding: 2px 6px; border-radius: 4px; font-size: 0.875em; font-family: 'Fira Code', 'Consolas', monospace; }
        .blog-body pre { background: #0f0f0f; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px 24px; overflow-x: auto; margin: 24px 0; }
        .blog-body pre code { background: transparent; color: #e2e2e2; padding: 0; font-size: 14px; }
        .blog-body hr { border: none; border-top: 1px solid var(--border-divider); margin: 40px 0; }
        .blog-body img { max-width: 100%; border-radius: 12px; border: 1px solid var(--border-color); margin: 24px 0; }
      `}</style>
    </div>
  );
};

export default BlogPost;
