import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Blog } from '../../../types/database';

const AdminBlogs = () => {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  useEffect(() => {
    supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBlogs(data ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = filter === 'all' ? blogs : blogs.filter(b => b.status === filter);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ color: '#ffffff', fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Blog Posts</h1>
          <p style={{ color: '#555', fontSize: 14, marginTop: 6 }}>
            {blogs.length} total · {blogs.filter(b => b.status === 'published').length} published · {blogs.filter(b => b.status === 'draft').length} drafts
          </p>
        </div>
        <Link
          to="/admin/blogs/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: '#ffffff',
            color: '#0a0a0a',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.88')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New post
        </Link>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['all', 'published', 'draft'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              border: '1px solid',
              borderColor: filter === f ? '#444' : '#1e1e1e',
              background: filter === f ? '#1e1e1e' : 'transparent',
              color: filter === f ? '#ffffff' : '#555',
              fontSize: 13,
              fontWeight: filter === f ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: '#555', fontSize: 14 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12,
          padding: '64px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>✍️</div>
          <p style={{ color: '#555', fontSize: 15, margin: 0 }}>
            {filter !== 'all' ? `No ${filter} posts.` : 'No posts yet.'}
          </p>
          <Link to="/admin/blogs/new" style={{ display: 'inline-block', marginTop: 16, color: '#888', fontSize: 14 }}>
            Write your first post →
          </Link>
        </div>
      ) : (
        <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '3fr 1fr 1fr 120px 80px',
            padding: '10px 20px',
            borderBottom: '1px solid #1a1a1a',
            color: '#444', fontSize: 12, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            <span>Title</span>
            <span>Category</span>
            <span>Status</span>
            <span>Date</span>
            <span />
          </div>

          {filtered.map((blog, i) => (
            <div
              key={blog.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 1fr 1fr 120px 80px',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #1a1a1a' : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ color: '#ddd', fontSize: 14, fontWeight: 500 }}>{blog.title}</div>
                {blog.excerpt && (
                  <div style={{
                    color: '#555', fontSize: 12, marginTop: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400,
                  }}>
                    {blog.excerpt}
                  </div>
                )}
              </div>
              <span style={{ color: '#555', fontSize: 13 }}>{blog.category || '—'}</span>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                fontSize: 11, fontWeight: 600, width: 'fit-content',
                background: blog.status === 'published' ? 'rgba(16,185,129,0.12)' : 'rgba(100,100,100,0.15)',
                color: blog.status === 'published' ? '#10b981' : '#666',
              }}>
                {blog.status === 'published' ? 'Published' : 'Draft'}
              </span>
              <span style={{ color: '#444', fontSize: 13 }}>{formatDate(blog.created_at)}</span>
              <Link
                to={`/admin/blogs/${blog.id}`}
                style={{
                  display: 'inline-block', padding: '5px 12px',
                  border: '1px solid #2a2a2a', borderRadius: 6,
                  color: '#888', fontSize: 13, textDecoration: 'none',
                  transition: 'all 0.15s', width: 'fit-content', justifySelf: 'end',
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#444'; el.style.color = '#fff'; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = '#2a2a2a'; el.style.color = '#888'; }}
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminBlogs;
