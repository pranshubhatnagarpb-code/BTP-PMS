// Diet guidelines imported from Word: .docx -> clean HTML, kept to a small set
// of tags so it prints safely inside the diet plan PDF.
import mammoth from 'mammoth';

// Paragraphs styled "Header" repeat the dietitian's letterhead, which the plan
// PDF already prints, so they're dropped.
const STYLE_MAP = ["p[style-name='header'] => !", "p[style-name='Header'] => !", "p[style-name='footer'] => !"];

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'a', 'img', 'blockquote',
]);
const ALLOWED_ATTRS: Record<string, string[]> = { a: ['href'], img: ['src', 'alt'], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'] };

/** Keeps only the allowed tags / attributes (links: http(s)/mailto; images: inline data). */
export const sanitizeGuidelineHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(clean).join('');
    if (!ALLOWED_TAGS.has(tag)) return ['script', 'style', 'iframe', 'object'].includes(tag) ? '' : inner;
    const attrs = (ALLOWED_ATTRS[tag] || [])
      .map((name) => {
        const value = el.getAttribute(name);
        if (value === null) return '';
        if (name === 'href' && !/^(https?:|mailto:)/i.test(value)) return '';
        if (name === 'src' && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return '';
        return ` ${name}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`;
      })
      .join('');
    return tag === 'br' || tag === 'img' ? `<${tag}${attrs}>` : `<${tag}${attrs}>${inner}</${tag}>`;
  };
  return Array.from(doc.body.firstElementChild?.childNodes ?? []).map(clean).join('').trim();
};

/** A Word document's content as clean HTML. */
export const docxToGuidelineHtml = async (file: File): Promise<string> => {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() }, { styleMap: STYLE_MAP });
  return sanitizeGuidelineHtml(result.value);
};

// "Hives_Psoriasis guidelines.docx" -> "Hives Psoriasis guidelines"
export const guidelineTitleFromFile = (name: string) =>
  name.replace(/\.docx$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
