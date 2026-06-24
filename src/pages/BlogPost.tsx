import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, ArrowLeft, Tag } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { supabase } from '../lib/supabase';
import type { Blog } from '../types/database';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('blogs')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          setPost(data as Blog);
          document.title = `${data.title} — Xtenzium`;
        }
        setLoading(false);
      });
  }, [slug]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: true }),
      Image,
      Typography,
    ],
    content: post?.content ?? {},
    editable: false,
  }, [post]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Loading…</div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', gap: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '3rem', color: 'var(--text-primary)' }}>404</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This article doesn't exist or hasn't been published yet.</p>
        <Link to="/blogs" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', paddingTop: '100px' }}>

      {/* Hero */}
      {post.cover_image && (
        <div style={{ width: '100%', height: 'clamp(300px, 45vw, 520px)', overflow: 'hidden', position: 'relative' }}>
          <img
            src={post.cover_image}
            alt={post.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, var(--bg-primary))' }} />
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 6rem' }}>

        {/* Back link */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} style={{ paddingTop: post.cover_image ? '2rem' : '3rem', marginBottom: '2.5rem' }}>
          <Link to="/blogs" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Back to Blog
          </Link>
        </motion.div>

        {/* Meta */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {post.category && (
              <span style={{ background: 'var(--accent-blue)', color: '#fff', padding: '0.3rem 0.9rem', borderRadius: '2rem', fontSize: '0.8rem', fontWeight: 700 }}>
                {post.category}
              </span>
            )}
            {post.published_at && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                <Calendar size={14} />
                {new Date(post.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>

          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, color: 'var(--text-primary)', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
            {post.title}
          </h1>

          {post.excerpt && (
            <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2.5rem', borderLeft: '3px solid var(--accent-blue)', paddingLeft: '1.25rem' }}>
              {post.excerpt}
            </p>
          )}

          <div style={{ height: '1px', background: 'var(--border-divider)', marginBottom: '3rem' }} />
        </motion.div>

        {/* Body */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
          <div className="blog-prose">
            <EditorContent editor={editor} />
          </div>
        </motion.div>

        {/* Tags */}
        {post.tags?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.4 }} style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border-divider)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Tag size={16} color="var(--text-muted)" />
            {post.tags.map(tag => (
              <span key={tag} style={{ padding: '0.3rem 0.85rem', borderRadius: '2rem', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {tag}
              </span>
            ))}
          </motion.div>
        )}

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }} style={{ marginTop: '4rem', padding: '3rem', background: 'var(--accent-blue)', borderRadius: '1.5rem', textAlign: 'center' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '1rem' }}>
            Ready to build something remarkable?
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: '2rem', fontSize: '1rem' }}>
            Let's architect your long-term success together.
          </p>
          <Link to="/contact" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#fff', color: '#000', padding: '0.85rem 2rem', borderRadius: '2rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
            Start a Conversation →
          </Link>
        </motion.div>

      </div>

      <style>{`
        .blog-prose .ProseMirror {
          outline: none;
          color: var(--text-secondary);
          line-height: 1.8;
          font-size: 1.1rem;
        }
        .blog-prose .ProseMirror h1,
        .blog-prose .ProseMirror h2,
        .blog-prose .ProseMirror h3,
        .blog-prose .ProseMirror h4 {
          font-family: var(--font-heading);
          color: var(--text-primary);
          font-weight: 700;
          line-height: 1.3;
          margin: 2rem 0 1rem;
        }
        .blog-prose .ProseMirror h1 { font-size: 2rem; }
        .blog-prose .ProseMirror h2 { font-size: 1.6rem; }
        .blog-prose .ProseMirror h3 { font-size: 1.3rem; }
        .blog-prose .ProseMirror p { margin-bottom: 1.25rem; }
        .blog-prose .ProseMirror a { color: var(--accent-blue); text-decoration: underline; }
        .blog-prose .ProseMirror ul,
        .blog-prose .ProseMirror ol { padding-left: 1.75rem; margin-bottom: 1.25rem; }
        .blog-prose .ProseMirror li { margin-bottom: 0.5rem; }
        .blog-prose .ProseMirror blockquote {
          border-left: 3px solid var(--accent-blue);
          padding-left: 1.25rem;
          color: var(--text-secondary);
          font-style: italic;
          margin: 1.5rem 0;
        }
        .blog-prose .ProseMirror code {
          background: var(--bg-card);
          padding: 0.2em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          color: var(--accent-light);
        }
        .blog-prose .ProseMirror pre {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.5rem;
          overflow-x: auto;
          margin: 1.5rem 0;
        }
        .blog-prose .ProseMirror pre code {
          background: none;
          padding: 0;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .blog-prose .ProseMirror img {
          max-width: 100%;
          border-radius: 12px;
          margin: 1.5rem 0;
        }
        .blog-prose .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--border-divider);
          margin: 2.5rem 0;
        }
      `}</style>
    </div>
  );
};

export default BlogPost;
