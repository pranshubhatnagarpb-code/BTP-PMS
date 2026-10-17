// Parses the clinic's "Youtube Recipe links" Word document into recipe-bank
// entries: one dish per line ("PANEER BHURJI (RECIPE- <link>)", "Grilled
// fish: <link>"), grouped under bold category headings ("STIR FRY") with
// optional VEG / NON-VEG sub-headings. Lines without a link (written recipes,
// tips) are ignored.
import { unzipSync, strFromU8 } from 'fflate';

export interface RecipeLinkEntry {
  name: string;
  /** e.g. "Stir fry · Non-veg" */
  category: string;
  links: string[];
}

interface Paragraph {
  /** Text with hyperlink display text and URLs removed. */
  text: string;
  links: string[];
  bold: boolean;
}

const decodeXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');

const runText = (xml: string) =>
  decodeXml(
    (xml.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|<w:tab\/>|<w:br\/>/g) || [])
      .map((t) => (t.startsWith('<w:t') ? t.replace(/<[^>]+>/g, '') : ' '))
      .join(''),
  );

// Plain-text links, including the doc's typos "https: //" and "htps://".
const URL_IN_TEXT = /\b(?:https?|htps?):\s?\/\/[^\s)\]]+/gi;

// Links typed without the scheme, e.g. "w.youtube.com/watch?v=..."
const BARE_URL = /(?<![\w./])(?:w{1,3}\.)?(?:youtube\.com|youtu\.be|instagram\.com)\/[^\s)\]]+/gi;

const cleanUrl = (raw: string) =>
  raw
    .replace(/^htps?:/i, (m) => (m.toLowerCase().startsWith('htp') ? 'https:' : m))
    .replace(/^(https?:)\s+\/\//i, '$1//')
    .replace(/[.,;:)\]]+$/, '');

const parseParagraphs = (documentXml: string, relsXml: string): Paragraph[] => {
  const targets = new Map<string, string>();
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const target = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target && /hyperlink/.test(m[0])) targets.set(id, decodeXml(target));
  }

  return (documentXml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []).map((p) => {
    const links: string[] = [];
    // Hyperlinks: keep the target. The display text is kept too when it's part
    // of the dish name ("1 bowl <kachumber salad>"); a pasted URL or video
    // title is stripped below.
    let rest = p.replace(/<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/g, (_, attrs: string, inner: string) => {
      const target = targets.get(attrs.match(/r:id="([^"]+)"/)?.[1] ?? '');
      if (target) links.push(target);
      return inner;
    });
    // Field-code hyperlinks: HYPERLINK "url"
    for (const m of rest.matchAll(/HYPERLINK\s+(?:&quot;|")([^"&]+)/g)) links.push(decodeXml(m[1]));
    rest = rest.replace(/<w:instrText[^>]*>[^<]*<\/w:instrText>/g, '');
    let text = runText(rest);
    text = text.replace(URL_IN_TEXT, (u) => {
      links.push(u);
      return ' ';
    });
    text = text.replace(BARE_URL, (u) => {
      links.push(`https://${u.replace(/^w{1,3}\./i, 'www.')}`);
      return ' ';
    });
    // Pasted video titles: "(146) Healthy Poha Tikki Recipe | ... - YouTube"
    text = text.replace(/(?:\(\d+\)\s*)?[^()]*\|[^()]*?-\s*YouTube/gi, ' ').replace(/\s*-\s*YouTube\b/gi, ' ');
    const bold = /<w:b\/>|<w:b w:val="(?:1|true)"\/>/.test(p);
    return {
      text: text.replace(/\s+/g, ' ').trim(),
      links: [...new Set(links.map(cleanUrl).filter((u) => /^https?:\/\/\S+\.\S+/.test(u)))],
      bold,
    };
  });
};

const SUB_HEADING = /^(non[\s-]?veg|veg)\s*:?$/i;
// Parts of written recipes, not categories.
const NOT_HEADING = /^(ingredients?|method|directions?|how to have it|benefits)\b/i;

const count = (s: string, ch: string) => s.split(ch).length - 1;

const tidyName = (raw: string) => {
  let name = raw
    // "(RECIPE-", "(recipe -", "RECIPE:" and the "-", ":" or "/" left where links were removed
    .replace(/[([]?\s*\b(?:recipe|recipie|reicpe|revipe|reipe|receipe|recepie)\b\s*[-:–]*\s*[)\]]?/gi, ' ')
    // "; reference" left before a removed link
    .replace(/[;,]?\s*reference\s*[-:–]*\s*(?=\)|$)/gi, '')
    // "Name: / (no oats)" left between two removed links
    .replace(/\s*:?\s*\/\s*(?=\(|$)/g, ' ')
    .replace(/:\s*(?=\()/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–:•*/]+|[\s\-–:/,(&]+$/g, '')
    .trim();
  // drop closing brackets that belonged to the removed "(RECIPE- link)"
  while (name.endsWith(')') && count(name, ')') > count(name, '(')) name = name.slice(0, -1).trim();
  name = name.replace(/[\s\-–:/,;(&]+$/, '');
  // "Fish fry (without oil;" -> "Fish fry (without oil)"
  if (count(name, '(') > count(name, ')')) name += ')';
  // ALL-CAPS names read better in sentence case
  return /[a-z]/.test(name) ? name : name.toLowerCase().replace(/^./, (c) => c.toUpperCase());
};

const tidyHeading = (raw: string) => {
  const h = raw.replace(/[:*]+/g, ' ').replace(/\s+/g, ' ').trim();
  return h.toLowerCase().replace(/^./, (c) => c.toUpperCase());
};

export const parseRecipeLinkParagraphs = (documentXml: string, relsXml: string): RecipeLinkEntry[] => {
  const entries: RecipeLinkEntry[] = [];
  let heading = '';
  let sub = '';
  let lastNameOnly = '';
  for (const p of parseParagraphs(documentXml, relsXml)) {
    if (!p.links.length) {
      if (!p.text) continue;
      if (SUB_HEADING.test(p.text)) {
        sub = /non/i.test(p.text) ? 'Non-veg' : 'Veg';
      } else if (p.bold && p.text.length <= 60 && !/^\d/.test(p.text) && !NOT_HEADING.test(p.text)) {
        heading = tidyHeading(p.text);
        sub = '';
      }
      // A dish name on its own line may be followed by a line with just the link.
      lastNameOnly = p.text.length <= 80 ? p.text : '';
      continue;
    }
    const name = tidyName(p.text);
    // Written-recipe steps that happen to contain a link
    if (/\.\s+[A-Z]/.test(name)) continue;
    const category = [heading, sub].filter(Boolean).join(' · ');
    if (name.length >= 3) {
      entries.push({ name, category, links: p.links });
    } else if (lastNameOnly && entries.at(-1)?.name !== tidyName(lastNameOnly)) {
      entries.push({ name: tidyName(lastNameOnly), category, links: p.links });
    } else if (entries.length) {
      // Extra link(s) on their own line belong to the dish above.
      const prev = entries[entries.length - 1];
      prev.links = [...new Set([...prev.links, ...p.links])];
    }
    lastNameOnly = '';
  }
  return entries;
};

/** Reads a .docx file (as bytes) into recipe-link entries. */
export const parseRecipeLinksDocx = (bytes: Uint8Array): RecipeLinkEntry[] => {
  const files = unzipSync(bytes, {
    filter: (f) => f.name === 'word/document.xml' || f.name === 'word/_rels/document.xml.rels',
  });
  const doc = files['word/document.xml'];
  if (!doc) throw new Error('Not a Word document (word/document.xml missing)');
  const rels = files['word/_rels/document.xml.rels'];
  return parseRecipeLinkParagraphs(strFromU8(doc), rels ? strFromU8(rels) : '');
};
