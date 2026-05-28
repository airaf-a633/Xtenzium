import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { useEffect, useCallback } from 'react';

interface TiptapEditorProps {
  content: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
  placeholder?: string;
}

// ─── Toolbar button ────────────────────────────────────────

const ToolBtn = ({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 30,
      height: 30,
      borderRadius: 6,
      border: 'none',
      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
      color: active ? '#ffffff' : '#888',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'all 0.15s',
      flexShrink: 0,
    }}
    onMouseEnter={e => {
      if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
    }}
    onMouseLeave={e => {
      if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
    }}
  >
    {children}
  </button>
);

const Divider = () => (
  <div style={{ width: 1, height: 20, background: '#2a2a2a', margin: '0 4px', flexShrink: 0 }} />
);

// ─── Editor ────────────────────────────────────────────────

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, placeholder }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Start writing…',
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({
        inline: false,
      }),
      Typography,
    ],
    content: Object.keys(content).length > 0 ? content : undefined,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
  });

  // Sync content from outside (e.g. loading a saved post)
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming && Object.keys(content).length > 0) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL', prev);
    if (url === null) return;
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('Image URL');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div style={{
      border: '1px solid #222',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#0f0f0f',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '8px 12px',
        borderBottom: '1px solid #1e1e1e',
        flexWrap: 'wrap',
      }}>
        {/* Headings */}
        <ToolBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolBtn>
        <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolBtn>
        <ToolBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolBtn>

        <Divider />

        {/* Marks */}
        <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </ToolBtn>
        <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </ToolBtn>
        <ToolBtn title="Inline code" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </ToolBtn>

        <Divider />

        {/* Lists */}
        <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Ordered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" stroke="currentColor"/><path d="M4 10h2" stroke="currentColor"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" stroke="currentColor"/></svg>
        </ToolBtn>
        <ToolBtn title="Blockquote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </ToolBtn>

        <Divider />

        {/* Code block */}
        <ToolBtn title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M8 10l-3 3 3 3"/><path d="M16 10l3 3-3 3"/><path d="M12 7l-2 10"/></svg>
        </ToolBtn>
        <ToolBtn title="Horizontal rule" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </ToolBtn>

        <Divider />

        {/* Link + Image */}
        <ToolBtn title="Add link" active={editor.isActive('link')} onClick={setLink}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </ToolBtn>
        <ToolBtn title="Add image" active={false} onClick={addImage}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </ToolBtn>

        <Divider />

        {/* Undo / Redo */}
        <ToolBtn title="Undo" active={false} onClick={() => editor.chain().focus().undo().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </ToolBtn>
        <ToolBtn title="Redo" active={false} onClick={() => editor.chain().focus().redo().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
        </ToolBtn>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} style={{ padding: '20px 24px', minHeight: 360 }} />

      <style>{`
        .tiptap-content:focus { outline: none; }
        .tiptap-content > * + * { margin-top: 0.75em; }
        .tiptap-content h1 { color: #ffffff; font-size: 2em; font-weight: 700; line-height: 1.2; letter-spacing: -0.5px; }
        .tiptap-content h2 { color: #ffffff; font-size: 1.5em; font-weight: 700; line-height: 1.3; }
        .tiptap-content h3 { color: #e0e0e0; font-size: 1.2em; font-weight: 600; }
        .tiptap-content p { color: #aaa; line-height: 1.75; font-size: 15px; }
        .tiptap-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #444;
          pointer-events: none;
          height: 0;
        }
        .tiptap-content strong { color: #ddd; }
        .tiptap-content em { color: #bbb; }
        .tiptap-content code { background: #1a1a1a; color: #e2a0ff; padding: 2px 6px; border-radius: 4px; font-size: 0.875em; font-family: 'Fira Code', 'Consolas', monospace; }
        .tiptap-content pre { background: #141414; border: 1px solid #222; border-radius: 8px; padding: 16px 20px; overflow-x: auto; }
        .tiptap-content pre code { background: transparent; color: #e2e2e2; padding: 0; font-size: 14px; }
        .tiptap-content blockquote { border-left: 3px solid #333; padding-left: 16px; color: #666; font-style: italic; }
        .tiptap-content ul, .tiptap-content ol { padding-left: 24px; color: #aaa; line-height: 1.75; }
        .tiptap-content li { margin: 4px 0; }
        .tiptap-content hr { border: none; border-top: 1px solid #222; margin: 24px 0; }
        .tiptap-content a { color: #818cf8; text-decoration: underline; }
        .tiptap-content img { max-width: 100%; border-radius: 8px; border: 1px solid #222; }
      `}</style>
    </div>
  );
};

export default TiptapEditor;
