import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { BlogStatus } from '../../../types/database';
import TiptapEditor from '../../../components/admin/TiptapEditor';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  cover_image: string;
  category: string;
  tags: string; // comma-separated in UI
  status: BlogStatus;
  content: Record<string, unknown>;
}

const INITIAL: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  cover_image: '',
  category: '',
  tags: '',
  status: 'draft',
  content: {},
};

const CATEGORIES = [
  'Development', 'Design', 'IoT & Electronics', 'AI & Automation',
  'Marketing', 'Agency Life', 'Case Study',
];

const BlogEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  const [form, setForm] = useState<FormState>(INITIAL);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Load existing post
  useEffect(() => {
    if (isNew) return;
    supabase.from('blogs').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setForm({
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt ?? '',
          cover_image: data.cover_image ?? '',
          category: data.category ?? '',
          tags: data.tags.join(', '),
          status: data.status,
          content: data.content,
        });
        setSlugEdited(true); // don't auto-overwrite slug on load
      }
      setLoading(false);
    });
  }, [id, isNew]);

  // Auto-generate slug from title (only if user hasn't manually edited it)
  useEffect(() => {
    if (!slugEdited && form.title) {
      setForm(prev => ({ ...prev, slug: slugify(prev.title) }));
    }
  }, [form.title, slugEdited]);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleContentChange = useCallback((json: Record<string, unknown>) => {
    setForm(prev => ({ ...prev, content: json }));
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `cover-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage
      .from('blog-images')
      .upload(fileName, file, { upsert: true });
    if (error) {
      alert(`Upload failed: ${error.message}`);
      setUploadingCover(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('blog-images').getPublicUrl(data.path);
    setForm(prev => ({ ...prev, cover_image: publicUrl }));
    setUploadingCover(false);
    e.target.value = '';
  };

  const handleSave = async (statusOverride?: BlogStatus) => {
    setSaving(true);
    setSaveMsg('');

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      cover_image: form.cover_image.trim() || null,
      category: form.category.trim() || null,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: statusOverride ?? form.status,
      content: form.content,
      published_at: (statusOverride === 'published' || form.status === 'published')
        ? new Date().toISOString()
        : null,
    };

    let error;
    let newId = id;

    if (isNew) {
      const result = await supabase.from('blogs').insert(payload).select('id').single();
      error = result.error;
      newId = result.data?.id;
    } else {
      const result = await supabase.from('blogs').update(payload).eq('id', id!);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      setSaveMsg(`Error: ${error.message}`);
    } else {
      setSaveMsg(statusOverride === 'published' ? '✓ Published' : '✓ Saved');
      if (statusOverride) setForm(prev => ({ ...prev, status: statusOverride }));
      if (isNew && newId) navigate(`/admin/blogs/${newId}`, { replace: true });
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    background: '#0f0f0f',
    border: '1px solid #222',
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    color: '#555',
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  if (loading) {
    return <div style={{ color: '#555', fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>;
  }

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/admin/blogs"
            style={{ color: '#555', textDecoration: 'none', fontSize: 14 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#aaa')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#555')}
          >
            ← Blogs
          </Link>
          <h1 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>
            {isNew ? 'New post' : 'Edit post'}
          </h1>
          <span style={{
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: form.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(100,100,100,0.2)',
            color: form.status === 'published' ? '#10b981' : '#666',
          }}>
            {form.status === 'published' ? 'Published' : 'Draft'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {saveMsg && (
            <span style={{
              fontSize: 13,
              color: saveMsg.startsWith('Error') ? '#ef4444' : '#10b981',
            }}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || !form.title}
            style={{
              padding: '9px 18px',
              background: 'transparent',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              color: '#888',
              fontSize: 13,
              fontWeight: 500,
              cursor: saving || !form.title ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Save draft
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving || !form.title || !form.slug}
            style={{
              padding: '9px 18px',
              background: saving || !form.title ? '#1a1a1a' : '#ffffff',
              border: 'none',
              borderRadius: 8,
              color: saving || !form.title ? '#555' : '#0a0a0a',
              fontSize: 13,
              fontWeight: 700,
              cursor: saving || !form.title ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {form.status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
        {/* Main editor area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Title */}
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="Post title"
            style={{
              ...inputStyle,
              fontSize: 22,
              fontWeight: 700,
              padding: '14px 16px',
              letterSpacing: -0.5,
              border: '1px solid #1a1a1a',
            }}
            onFocus={e => (e.target.style.borderColor = '#333')}
            onBlur={e => (e.target.style.borderColor = '#1a1a1a')}
          />

          {/* Excerpt */}
          <textarea
            value={form.excerpt}
            onChange={set('excerpt')}
            placeholder="Short excerpt shown on blog listing (optional)"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            onFocus={e => (e.target.style.borderColor = '#444')}
            onBlur={e => (e.target.style.borderColor = '#222')}
          />

          {/* Rich text editor */}
          <TiptapEditor
            content={form.content}
            onChange={handleContentChange}
            placeholder="Write your post here…"
          />
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 20 }}>
          {/* Slug */}
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: 18 }}>
            <label style={labelStyle}>Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={e => { setSlugEdited(true); set('slug')(e); }}
              placeholder="post-url-slug"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#444')}
              onBlur={e => (e.target.style.borderColor = '#222')}
            />
            <div style={{ color: '#444', fontSize: 11, marginTop: 8 }}>
              /blog/<span style={{ color: '#666' }}>{form.slug || 'post-slug'}</span>
            </div>
          </div>

          {/* Cover image */}
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: 18 }}>
            <label style={labelStyle}>Cover Image</label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={uploadingCover}
              style={{
                width: '100%',
                padding: '9px 14px',
                background: 'transparent',
                border: '1px dashed #2a2a2a',
                borderRadius: 8,
                color: uploadingCover ? '#444' : '#555',
                fontSize: 13,
                cursor: uploadingCover ? 'not-allowed' : 'pointer',
                marginBottom: 10,
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => { if (!uploadingCover) (e.currentTarget as HTMLElement).style.borderColor = '#444'; }}
              onMouseLeave={e => { if (!uploadingCover) (e.currentTarget as HTMLElement).style.borderColor = '#2a2a2a'; }}
            >
              {uploadingCover ? 'Uploading…' : '↑  Upload image'}
            </button>
            <input
              type="url"
              value={form.cover_image}
              onChange={set('cover_image')}
              placeholder="or paste URL…"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#444')}
              onBlur={e => (e.target.style.borderColor = '#222')}
            />
            {form.cover_image && (
              <img
                src={form.cover_image}
                alt="Cover preview"
                style={{ width: '100%', borderRadius: 6, marginTop: 10, objectFit: 'cover', height: 100 }}
                onError={e => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
              />
            )}
          </div>

          {/* Category */}
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: 18 }}>
            <label style={labelStyle}>Category</label>
            <select
              value={form.category}
              onChange={set('category')}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="">— Select —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: 18 }}>
            <label style={labelStyle}>Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={set('tags')}
              placeholder="react, design, ai"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#444')}
              onBlur={e => (e.target.style.borderColor = '#222')}
            />
            <div style={{ color: '#444', fontSize: 11, marginTop: 6 }}>Comma-separated</div>
          </div>

          {/* Delete */}
          {!isNew && (
            <button
              onClick={async () => {
                if (!confirm('Delete this post permanently?')) return;
                await supabase.from('blogs').delete().eq('id', id!);
                navigate('/admin/blogs');
              }}
              style={{
                padding: '10px',
                background: 'transparent',
                border: '1px solid #2a1a1a',
                borderRadius: 8,
                color: '#9b4545',
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#7f1d1d';
                (e.currentTarget as HTMLElement).style.color = '#ef4444';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = '#2a1a1a';
                (e.currentTarget as HTMLElement).style.color = '#9b4545';
              }}
            >
              Delete post
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlogEdit;
