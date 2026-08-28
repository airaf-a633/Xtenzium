/**
 * TipTap / ProseMirror JSON → HTML, rendered at build time.
 *
 * The SPA displays posts by mounting a read-only TipTap editor, which drags
 * the whole editor into the bundle to show static prose. On a static site we
 * can just serialise the document once at build and ship plain HTML — no
 * editor, no JS, and the words are in the markup for crawlers.
 *
 * Hand-written rather than using `@tiptap/html` on purpose: that needs a DOM
 * shim in Node and pins us to matching extension versions at build time. The
 * node set StarterKit produces is small and stable, and owning the serialiser
 * means owning the escaping.
 *
 * Escaping: every text node and every attribute is escaped. `href` and `src`
 * are additionally restricted to safe schemes — posts are authored by
 * authenticated staff, but a stored `javascript:` URL should not become a
 * live link because we assumed the input was clean.
 */

interface PMMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
}

const SAFE_SCHEME = /^(https?:|mailto:|tel:|\/|#)/i;

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(value: unknown): string | null {
  const url = String(value ?? '').trim();
  if (!url || !SAFE_SCHEME.test(url)) return null;
  return esc(url);
}

/** Wraps text in its marks, innermost first. */
function applyMarks(text: string, marks: PMMark[] = []): string {
  return marks.reduce((acc, mark) => {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        return `<strong>${acc}</strong>`;
      case 'italic':
      case 'em':
        return `<em>${acc}</em>`;
      case 'strike':
        return `<s>${acc}</s>`;
      case 'code':
        return `<code>${acc}</code>`;
      case 'underline':
        return `<u>${acc}</u>`;
      case 'link': {
        const href = safeUrl(mark.attrs?.href);
        if (!href) return acc; // drop the link, keep the words
        const external = /^https?:/i.test(href);
        const rel = external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${href}"${rel}>${acc}</a>`;
      }
      default:
        return acc;
    }
  }, text);
}

function renderNodes(nodes: PMNode[] = []): string {
  return nodes.map(renderNode).join('');
}

function renderNode(node: PMNode): string {
  switch (node.type) {
    case 'doc':
      return renderNodes(node.content);

    case 'text':
      return applyMarks(esc(node.text), node.marks);

    case 'paragraph': {
      const inner = renderNodes(node.content);
      // An empty paragraph is a deliberate blank line in the editor.
      return inner ? `<p>${inner}</p>` : '<p><br></p>';
    }

    case 'heading': {
      const raw = Number(node.attrs?.level ?? 2);
      // Posts start at h2 — the page title owns the h1.
      const level = Math.min(6, Math.max(2, raw));
      return `<h${level}>${renderNodes(node.content)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul>${renderNodes(node.content)}</ul>`;

    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      const attr = start && start !== 1 ? ` start="${esc(start)}"` : '';
      return `<ol${attr}>${renderNodes(node.content)}</ol>`;
    }

    case 'listItem':
      return `<li>${renderNodes(node.content)}</li>`;

    case 'blockquote':
      return `<blockquote>${renderNodes(node.content)}</blockquote>`;

    case 'codeBlock': {
      const lang = node.attrs?.language;
      const cls = lang ? ` class="language-${esc(lang)}"` : '';
      return `<pre><code${cls}>${esc(node.content?.[0]?.text ?? '')}</code></pre>`;
    }

    case 'horizontalRule':
      return '<hr>';

    case 'hardBreak':
      return '<br>';

    case 'image': {
      const src = safeUrl(node.attrs?.src);
      if (!src) return '';
      const alt = esc(node.attrs?.alt ?? '');
      const title = node.attrs?.title ? ` title="${esc(node.attrs.title)}"` : '';
      return `<img src="${src}" alt="${alt}"${title} loading="lazy" decoding="async">`;
    }

    default:
      // Unknown node: keep the words rather than dropping content silently.
      return renderNodes(node.content);
  }
}

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== 'object') return '';
  const node = doc as PMNode;
  if (!node.type && !node.content) return '';
  return renderNode(node.type ? node : { type: 'doc', content: node.content });
}

/** Plain text, for excerpts and reading time. */
export function tiptapToText(doc: unknown): string {
  const out: string[] = [];
  const walk = (n: PMNode) => {
    if (n.type === 'text' && n.text) out.push(n.text);
    n.content?.forEach(walk);
  };
  if (doc && typeof doc === 'object') walk(doc as PMNode);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

/** Rounded up, floored at one minute. 200 wpm is the usual reading estimate. */
export function readingMinutes(doc: unknown): number {
  const words = tiptapToText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
