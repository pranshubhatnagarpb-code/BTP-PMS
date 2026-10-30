// ---------------------------------------------------------------------------
// Bounce The Pound diet plan document.
//
// Every printable diet plan in the PMS (detailed plan, one-pager, important
// notes, manual plan builder) is rendered through this module so they all
// share the clinic's format: landscape page with a double border, logo on
// every page, social links footer, a two-column header table, and one
// DAY / TIME / MENU table per day followed by a green NOTE row.
// ---------------------------------------------------------------------------

export const CLINIC = {
  dietitianName: 'Ms. Saloni Anil Bhatt',
  qualification: 'MSc. Clinical Nutrition & Dietetics',
  email: 'bouncethepound@gmail.com',
  phone: '+91 7045338184',
  instagram: 'instagram.com/ bouncethepound',
  instagramUrl: 'https://instagram.com/bouncethepound',
  website: 'www.bouncethepound.com',
  websiteUrl: 'https://www.bouncethepound.com',
  facebook: 'facebook.com/bouncethepound',
  facebookUrl: 'https://facebook.com/bouncethepound',
};

/** Editable header block shown on the first page of a plan. */
export interface DietDocumentHeader {
  sessionNo?: string;
  /** yyyy-mm-dd */
  date?: string;
  /** yyyy-mm-dd */
  followUpDate?: string;
  weight?: string;
  caseText?: string;
  bloodParameters?: string;
  allergies?: string;
  triggers?: string;
  eliminations?: string[];
  dietType?: string[];
  goals?: string[];
  thingsToRemember?: string[];
  supplements?: string[];
  /** "Issue | Strategy" rows under the header table (e.g. Sleep -> keep dinner light). */
  issues?: { issue: string; strategy: string }[];
}

export interface DietDocumentMeal {
  period: string;
  time: string;
  menu: string;
  alternative?: string;
  note?: string;
  /** Portion, e.g. "2 katoris" (see formatServing). */
  serving?: string;
}

// Portion measure for a meal block (sizes in STANDARD_MEASUREMENTS):
// 1 bowl = 200 ml, 1 katori = 100 ml, 1 cup = 150 ml, 1 glass = 250 ml.
export type ServingUnit = 'bowl' | 'katori' | 'cup' | 'glass' | 'tsp' | 'tbsp';
export const SERVING_UNITS: { value: ServingUnit; label: string }[] = [
  { value: 'bowl', label: 'Bowl' },
  { value: 'katori', label: 'Katori' },
  { value: 'cup', label: 'Cup' },
  { value: 'glass', label: 'Glass' },
  { value: 'tsp', label: 'Tsp' },
  { value: 'tbsp', label: 'Tbsp' },
];
export const SERVING_QUANTITIES = [1, 2, 3] as const;

// tsp / tbsp read the same for any amount ("2 tsp").
const SERVING_PLURALS: Record<ServingUnit, string> = {
  bowl: 'bowls',
  katori: 'katoris',
  cup: 'cups',
  glass: 'glasses',
  tsp: 'tsp',
  tbsp: 'tbsp',
};

export const isServingUnit = (unit: unknown): unit is ServingUnit =>
  typeof unit === 'string' && unit in SERVING_PLURALS;

/** "1 bowl", "2 katoris", "2 glasses", "3 tsp"; empty when no unit is set. */
export const formatServing = (unit?: string | null, qty?: number | null): string => {
  if (!isServingUnit(unit)) return '';
  const n = qty && qty > 0 ? qty : 1;
  return `${n} ${n > 1 ? SERVING_PLURALS[unit] : unit}`;
};

export interface DietDocumentDay {
  label: string;
  dates?: string;
  meals: DietDocumentMeal[];
  notes?: string[];
}

export interface DietDocumentRecipe {
  name: string;
  ingredients?: string;
  instructions?: string;
  remarks?: string;
  /** YouTube / Instagram recipe videos. */
  links?: string[];
}

const hasWrittenRecipe = (r: DietDocumentRecipe) => Boolean(r.ingredients?.trim() || r.instructions?.trim());

/** Where a recipe name in the menu points: the video for link-only recipes, else the recipe section. */
const recipeHref = (r: DietDocumentRecipe, i: number) =>
  !hasWrittenRecipe(r) && r.links?.length ? escapeHtml(r.links[0]) : `#recipe-${i}`;

/**
 * The clinic's two diet plan layouts:
 * - tabular: landscape, one DAY / TIME / MENU table per day.
 * - open: portrait, one MEAL TYPE / TIME / MENU table for the whole plan, each
 *   meal listing the options per day ("MON - WED: ... OR TUE: ...").
 */
export type DietDocumentFormat = 'tabular' | 'open';
export const DIET_DOCUMENT_FORMATS: { value: DietDocumentFormat; label: string }[] = [
  { value: 'tabular', label: 'Tabular Format' },
  { value: 'open', label: 'Open Format' },
];

export interface DietDocumentInput {
  /** Defaults to 'tabular'. */
  format?: DietDocumentFormat;
  /** Browser tab / file name. */
  documentTitle: string;
  clientName: string;
  header: DietDocumentHeader;
  /** Heading above the day tables, e.g. "FAT LOSS DIET". */
  dietTitle?: string;
  days: DietDocumentDay[];
  recipes?: DietDocumentRecipe[];
  /** Plate guide + measurements / pointers pages. Defaults to true. */
  includeGuidelines?: boolean;
  /** Extra free-form sections rendered after the day tables (already-escaped HTML). */
  extraSectionsHtml?: string;
  /** Diet guidelines appended after the plan, each on its own page (sanitised HTML). */
  guidelines?: { title: string; html: string }[];
}

// Measurements and pointers page — the clinic's standard text.
export const STANDARD_MEASUREMENTS = [
  '<strong>1 bowl =</strong> 200 ml bowl',
  '<strong>1 katori =</strong> 100 ml bowl',
  '<strong>1 cup =</strong> 150 ml',
  '<strong>1 glass =</strong> 250 ml',
  '<strong>Oil=</strong> 3 tsp/ day (cold pressed groundnut/ sesame / mustard/ avocado oil for cooking; brand- Gramiya)',
  '<strong>Sugar/ jaggery/ honey=</strong> 2 tsp/ day (if recommended)',
  '<strong>Salt=</strong> 2 tsp/ day',
  '<strong>Water=</strong> 12-15 glasses/ day',
];

export const STANDARD_POINTERS = [
  'It is important to have <strong>small frequent meals</strong>; hence <strong>do not miss any mid meals</strong>',
  'If you <strong>miss any meal; you will tend to eat more</strong> in the coming meal',
  'Opt for <strong>1 glass lime water soda (sour)/ diet coke</strong> if needed',
  'Please <strong>maintain portion sizes</strong> compulsorily',
  'If you feel hungry in between these meals, <strong>first drink a glass of water</strong>',
  'Make sure you <strong>feel light after each meal</strong>',
  'It is best to <strong>avoid potato</strong> while on an active weight loss journey.',
  '<strong>Read the diet plan thoroughly</strong> and follow each meal and <strong>supplement</strong> as mentioned. ☺',
  'Kindly <strong>chew your meals</strong> properly. Each main meal should take <strong>15-20 mins to eat.</strong>',
];

// Rows every plan carries under these meals (the clinic's compulsory
// reminders), added to the PDF automatically like the header box. A line the
// meal's own note already says is not repeated.
interface CompulsoryLine {
  text: string;
  red?: boolean;
  /** Matches a note that already says this. */
  present: RegExp;
}
interface CompulsoryRow {
  /** Meal type it follows: "Breakfast", but not "Pre-breakfast" / "Post breakfast". */
  meal: string;
  lines: CompulsoryLine[];
}
export const COMPULSORY_ROWS: CompulsoryRow[] = [
  {
    meal: 'breakfast',
    lines: [{ text: '*PLEASE DO NOT SLEEP/ SIT IMMEDIATELY—WALK FOR 10-15 MINS POST BREAKFAST—COMPULSORY*', present: /walk.*post[\s-]*breakfast/i }],
  },
  {
    meal: 'lunch',
    lines: [
      { text: 'Make sure you feel light after lunch & half your plate should be filled with vegetables', red: true, present: /half (of )?your plate/i },
      { text: '*PLEASE DO NOT SLEEP/ SIT IMMEDIATELY—WALK FOR 10-15 MINS POST LUNCH—COMPULSORY*', present: /walk.*post[\s-]*lunch/i },
    ],
  },
  {
    meal: 'evening',
    lines: [{ text: 'AVOID FRIED AND SUGARY SNACKS', present: /avoid fried/i }],
  },
  {
    meal: 'dinner',
    lines: [{ text: 'PLEASE DO NOT SLEEP/ SIT IMMEDIATELY—WALK FOR 15-20 MINS POST DINNER—COMPULSORY', red: true, present: /walk.*post[\s-]*dinner/i }],
  },
];

/** A reminder every plan gets automatically (e.g. when reading an old plan back in). */
export const isCompulsoryLine = (text: string) =>
  COMPULSORY_ROWS.some((r) => r.lines.some((l) => l.present.test(text)));

const isMealOfType = (period: string, meal: string) =>
  new RegExp(`\\b${meal}\\b`, 'i').test(period) && !new RegExp(`\\b(pre|post|mid)[\\s-]*${meal}`, 'i').test(period);

/**
 * The compulsory row for a meal, once per table (`done` tracks which were used).
 * `notes` is what the meal's notes already say.
 */
const compulsoryRowHtml = (period: string, notes: string, colspan: number, done: Set<CompulsoryRow>): string => {
  const row = COMPULSORY_ROWS.find((r) => !done.has(r) && isMealOfType(period || '', r.meal));
  if (!row) return '';
  done.add(row);
  const lines = row.lines.filter((l) => !l.present.test(notes));
  if (!lines.length) return '';
  const html = lines.map((l) => `<p${l.red ? ' class="red"' : ''}>${escapeHtml(l.text)}</p>`).join('');
  return `<tr class="compulsory-row"><td colspan="${colspan}">${html}</td></tr>`;
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export const escapeHtml = (str: string): string =>
  (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes text and applies the editor's **bold**, _italic_ and ==highlight== markers and line breaks. */
export const formatRichText = (str: string): string =>
  escapeHtml(str)
    .replace(/\n/g, '<br/>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
    .replace(/(^|[\s(>])_([^_\n]+)_(?=$|[\s.,;:!?)<])/g, '$1<em>$2</em>');

/** Splits free text into bullet items (one per line, leading bullet characters removed). */
export const toBulletList = (text?: string | string[] | null): string[] => {
  if (!text) return [];
  const lines = Array.isArray(text) ? text : text.split(/\r?\n/);
  // "* " is a bullet, "**bold**" is not
  return lines.map((l) => l.replace(/^\s*(?:[-•●▪]|\*(?!\*))\s*/, '').trim()).filter(Boolean);
};

/**
 * Day NOTE bullets follow the clinic's conventions: meal-prep reminders are
 * highlighted yellow and the physical activity for the day is underlined.
 */
const formatDayNote = (note: string): string => {
  const activity = note.match(/^(physical activity for the day:)\s*(.+)$/i);
  if (activity) return `${formatRichText(activity[1])} <u>${formatRichText(activity[2])}</u>`;
  if (/^prep\b/i.test(note) && !note.includes('==')) return `<mark>${formatRichText(note)}</mark>`;
  return formatRichText(note);
};

/** yyyy-mm-dd (or anything Date can parse) -> dd/mm/yyyy */
export const formatDocDate = (value?: string): string => {
  if (!value) return '';
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const bullets = (items: string[], rich = true) =>
  items.length
    ? `<ul class="bullets">${items.map((i) => `<li>${rich ? formatRichText(i) : i}</li>`).join('')}</ul>`
    : '';

/** Wraps recipe names that appear in plain-text parts of `html` with links to the recipe section. */
const linkRecipes = (html: string, recipes: DietDocumentRecipe[]): string => {
  if (!recipes.length) return html;
  const patterns = recipes
    // "Mexican soup (has rajma)" links wherever the plan says "Mexican soup"
    .map((r, i) => {
      const base = r.name.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
      return { i, name: base.length >= 3 ? base : r.name.trim() };
    })
    .filter((r) => r.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length)
    .map((r) => ({
      i: r.i,
      re: new RegExp(
        // (?<!\w) / (?!\w) rather than \b, so names ending in ")" still match
        `(?<!\\w)(${escapeHtml(r.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')})(?!\\w)`,
        'i',
      ),
    }));
  let insideLink = false;
  return html
    .split(/(<[^>]+>)/)
    .map((part) => {
      if (part.startsWith('<')) {
        if (/^<a\b/i.test(part)) insideLink = true;
        if (/^<\/a>/i.test(part)) insideLink = false;
        return part;
      }
      if (insideLink) return part;
      let out = part;
      for (const p of patterns) {
        if (p.re.test(out)) {
          out = out.replace(p.re, `<a class="recipe-link" href="${recipeHref(recipes[p.i], p.i)}">$1</a>`);
          break; // one link per text run keeps nested replacements out
        }
      }
      return out;
    })
    .join('');
};

// ---------------------------------------------------------------------------
// building blocks
// ---------------------------------------------------------------------------

const STYLES = `
  @page { size: 11in 8.5in; margin: 0.3in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #fff; }
  body { font-family: Cambria, 'Cambria Math', Georgia, 'Times New Roman', serif; color: #000; font-size: 12.5px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  a { color: #0563C1; text-decoration: underline; }
  mark { background: #FFFF00; color: inherit; }

  /* Page furniture repeated on every printed page */
  .page-frame { position: fixed; inset: 0; border: 5px double #000; pointer-events: none; z-index: 0; }
  .page-frame::after { content: ''; position: absolute; inset: 3px; border: 1px solid #000; }
  .page-logo { position: fixed; top: 0.1in; left: 0; right: 0; text-align: center; z-index: 1; }
  .page-logo img { height: 0.62in; width: auto; }
  .page-footer { position: fixed; bottom: 0.08in; left: 0.12in; right: 0.12in; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 11.5px; z-index: 1; }
  .page-footer span { margin-right: 0.45in; }
  .page-footer a { color: #0563C1; }

  /* Repeating spacers keep content clear of the logo and footer on every page */
  table.layout { width: 100%; border-collapse: collapse; position: relative; z-index: 2; }
  table.layout > thead > tr > td, table.layout > tfoot > tr > td { padding: 0; border: 0; }
  .space-top { height: 0.82in; }
  .space-bottom { height: 0.38in; }
  table.layout > tbody > tr > td { padding: 0 0.62in; border: 0; }

  /* First page */
  .intro { display: grid; grid-template-columns: 1fr 2fr 1fr; align-items: start; margin-top: -0.55in; margin-bottom: 0.35in; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 13px; }
  .intro .session { padding-top: 0.12in; margin-left: -0.45in; }
  .intro .dietitian { text-align: center; font-family: Cambria, Georgia, serif; font-weight: 700; font-size: 13.5px; line-height: 1.3; padding-top: 0.6in; }
  .intro .dates { padding-top: 0.12in; text-align: left; }
  .intro .followup { display: inline-block; margin-top: 6px; border: 1.5px solid #999; padding: 6px 12px; font-weight: 700; font-size: 15px; }

  table.info { width: 100%; border-collapse: collapse; margin-bottom: 0.3in; }
  table.info td { border: 1px solid #000; padding: 7px 12px 7px 40px; vertical-align: top; font-weight: 700; }
  table.info td.label { width: 37%; }
  table.info td.value { padding-left: 40px; }
  table.info tr { page-break-inside: avoid; }
  table.info p + p { margin-top: 4px; }

  ul.bullets { list-style: disc; padding-left: 18px; }
  ul.bullets li { margin: 2px 0; }

  /* Day tables */
  .diet-title { text-align: center; font-weight: 700; text-decoration: underline; font-size: 14px; margin: 0.05in 0 0.18in; }
  .diet-start { page-break-before: always; }
  table.day { width: 100%; border-collapse: collapse; margin-bottom: 0.55in; }
  table.day td, table.day th { border: 1px solid #000; padding: 8px 9px; vertical-align: top; }
  table.day th { background: #F2F2F2; font-weight: 700; text-decoration: underline; text-align: center; }
  table.day th.day-name { background: #ACB9CA; width: 18%; }
  table.day th.time-head { width: 14%; }
  table.day td.period { background: #F2F2F2; font-weight: 700; text-align: center; }
  table.day td.time { font-weight: 700; text-align: center; }
  table.day td.menu p + p { margin-top: 8px; }
  table.day td.menu .alt-or { font-weight: 700; }
  table.info tr.issue-head td { background: #F2F2F2; }
  table.info tr.issue td { font-weight: 400; }
  table.day td.menu p.serving { margin-top: 4px; }
  table.day td.menu .meal-note { font-weight: 700; font-style: italic; margin-top: 8px; }
  table.day tr { page-break-inside: avoid; }
  table.day tr.note-row td { background: #E2EFDA; font-weight: 700; }
  table.day tr.compulsory-row td { text-align: center; font-weight: 700; }
  table.day tr.compulsory-row p + p { margin-top: 6px; }
  table.day tr.compulsory-row .red { color: #FF0000; }
  table.day tr.note-row td.note-label { text-align: center; text-decoration: underline; }
  table.day tr.note-row ul.bullets li { margin: 5px 0; }
  .day-dates { font-weight: 400; text-decoration: none; display: block; font-size: 11px; }

  /* Guidelines pages */
  .plate-heading { text-align: center; font-weight: 700; margin: 0.1in 0 0.15in; }
  .plate-img { display: block; margin: 0 auto; max-width: 72%; }
  .guidelines { page-break-before: always; }
  .guidelines h2 { text-align: center; font-size: 13px; font-weight: 700; margin-bottom: 0.15in; }
  .guidelines h3 { font-size: 12.5px; font-weight: 700; margin: 0.18in 0 0.08in; }
  .guidelines p.lead { padding-left: 0.3in; }
  .guidelines ul.bullets { padding-left: 0.3in; }
  .bowls-img { display: block; max-width: 62%; margin-top: 0.3in; }
  .keep-together { page-break-inside: avoid; }

  /* Imported diet guidelines */
  .diet-guideline { page-break-before: always; }
  .diet-guideline h2 { text-align: center; font-weight: 700; text-decoration: underline; font-size: 14px; margin-bottom: 0.18in; }
  .guideline-body p { margin: 4px 0; }
  .guideline-body h1, .guideline-body h2, .guideline-body h3 { font-size: 13px; font-weight: 700; margin: 0.14in 0 0.06in; text-decoration: none; text-align: left; }
  .guideline-body ul, .guideline-body ol { padding-left: 22px; margin: 4px 0; }
  .guideline-body ul { list-style: disc; }
  .guideline-body ol { list-style: decimal; }
  .guideline-body li { margin: 2px 0; }
  .guideline-body table { width: 100%; border-collapse: collapse; margin: 0.12in 0; }
  .guideline-body td, .guideline-body th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
  .guideline-body tr:first-child td, .guideline-body th { background: #F2F2F2; font-weight: 700; }
  .guideline-body tr { page-break-inside: avoid; }
  .guideline-body img { max-width: 100%; }

  /* Recipes */
  .recipes { page-break-before: always; }
  .recipes h2 { text-align: center; font-weight: 700; text-decoration: underline; font-size: 14px; margin-bottom: 0.2in; }
  .recipe { margin-bottom: 0.22in; page-break-inside: avoid; }
  .recipe h3 { font-size: 13px; font-weight: 700; text-decoration: underline; margin-bottom: 4px; }
  .recipe .block { margin-top: 4px; white-space: pre-wrap; }

  /* Extra sections (important notes etc.) */
  .extra h2 { text-align: center; font-weight: 700; text-decoration: underline; font-size: 14px; margin: 0.1in 0 0.18in; }
`;

const footerHtml = () => `
  <div class="page-footer">
    <span>${CLINIC.instagram}</span>
    <span><a href="${CLINIC.websiteUrl}">${CLINIC.website}</a></span>
    <span>${CLINIC.facebook}</span>
  </div>`;

/** First-page block: Session No, dietitian details, Date / F/Up. */
export const buildIntroHtml = (header: DietDocumentHeader): string => `
  <div class="intro">
    <div class="session">${header.sessionNo ? `Session No.: ${escapeHtml(header.sessionNo)}` : ''}</div>
    <div class="dietitian">
      ${escapeHtml(CLINIC.dietitianName)}<br/>
      (${escapeHtml(CLINIC.qualification)})<br/>
      E-mail: <a href="mailto:${CLINIC.email}">${CLINIC.email}</a><br/>
      Contact: ${escapeHtml(CLINIC.phone)}
    </div>
    <div class="dates">
      ${header.date ? `Date:${formatDocDate(header.date)}` : ''}
      ${header.followUpDate ? `<br/><span class="followup">F/Up: ${formatDocDate(header.followUpDate)}</span>` : ''}
    </div>
  </div>`;

/** Two-column info table. Rows with no value are left out. */
export const buildInfoTableHtml = (clientName: string, header: DietDocumentHeader): string => {
  const rows: [string, string][] = [];
  const text = (v?: string) => (v && v.trim() ? formatRichText(v.trim()) : '');
  rows.push(['Name:', escapeHtml(clientName)]);
  if (header.weight?.trim()) rows.push(['Weight:', text(header.weight)]);
  const blood = header.bloodParameters?.trim() || '';
  const bloodText = blood
    ? /^blood parameters/i.test(blood) ? text(blood) : `Blood parameters: ${text(blood)}`
    : '';
  const caseParts = [text(header.caseText), bloodText]
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');
  if (caseParts) rows.push(['Case:', caseParts]);
  rows.push(['Triggers:', text(header.triggers) || '--']);
  if (header.allergies?.trim()) rows.push(['Allergies', text(header.allergies)]);
  const listRows: [string, string[] | undefined][] = [
    ['Diet Type', header.dietType],
    ['Eliminations/ Aversions', header.eliminations],
    ['Goals', header.goals],
    ['THINGS TO REMEMBER', header.thingsToRemember],
    ['Medicines/ Supplements', header.supplements],
  ];
  listRows.forEach(([label, items]) => {
    const list = toBulletList(items);
    if (list.length) rows.push([label, bullets(list)]);
  });
  const issues = (header.issues || []).filter((i) => i.issue?.trim() || i.strategy?.trim());
  const issueRows = issues.length
    ? `<tr class="issue-head"><td class="label">Issue</td><td class="value">Strategy</td></tr>${issues
        .map((i) => `<tr class="issue"><td class="label">${text(i.issue)}</td><td class="value">${text(i.strategy)}</td></tr>`)
        .join('')}`
    : '';
  return `
  <table class="info">
    ${rows.map(([l, v]) => `<tr><td class="label">${l}</td><td class="value">${v}</td></tr>`).join('')}
    ${issueRows}
  </table>`;
};

/** Menu cell: menu, portion, OR alternative and (optionally) the meal note. */
// A label at the start of an option, written in capitals and ending in ":" —
// "2/WEEK:", "1/WEEK (compulsory):", "MON-TUE-WED:", "THU (fast day):", "ON THU:".
export const OPTION_TAG = /^([A-Z0-9][A-Z0-9 /&,.+-]{0,30}?(?:\s*\([^)]{1,30}\))?)\s*:\s+(\S.*)$/;

/**
 * Menu text in the clinic's weekly-menu style (Ishwari's plan): one option per
 * line (or block), a line with just "OR" between options, a line with just "+"
 * after items had with every option, and bold option labels like "2/WEEK:".
 */
export const formatMenuHtml = (text: string, recipes: DietDocumentRecipe[] = []): string => {
  const lines = (text || '').split(/\r?\n/);
  const out: string[] = [];
  let block: string[] = [];
  const flush = () => {
    if (!block.length) return;
    const first = block[0].trim();
    const tag = first.match(OPTION_TAG);
    const html = tag && /[A-Z]/.test(tag[1])
      ? `<strong class="opt-tag">${escapeHtml(tag[1].trim())}:</strong> ${formatRichText([tag[2], ...block.slice(1)].join('\n'))}`
      : formatRichText(block.join('\n'));
    out.push(`<p>${linkRecipes(html, recipes)}</p>`);
    block = [];
  };
  for (const line of lines) {
    const t = line.trim();
    if (/^or$/i.test(t)) {
      flush();
      out.push('<p class="alt-or">OR</p>');
    } else if (t === '+' || t === '&') {
      flush();
      out.push(`<p class="alt-or">${escapeHtml(t)}</p>`);
    } else if (OPTION_TAG.test(t) && block.length) {
      // A new labelled option starts a new paragraph.
      flush();
      block.push(line);
    } else {
      block.push(line);
    }
  }
  flush();
  return out.join('');
};

const buildMenuHtml = (meal: DietDocumentMeal, recipes: DietDocumentRecipe[], includeNote = true, prefix = '') => {
  const parts: string[] = [];
  const menu = formatMenuHtml(meal.menu || '', recipes);
  // A prefix (day label in the Open format) goes inside the first paragraph.
  parts.push(prefix ? menu.replace(/^<p>/, `<p>${prefix}`) || `<p>${prefix}</p>` : menu || '<p></p>');
  if (meal.serving) parts.push(`<p class="serving"><strong>Portion:</strong> ${escapeHtml(meal.serving)}</p>`);
  if (meal.alternative?.trim() && meal.alternative.trim() !== '-') {
    parts.push(`<p class="alt-or">OR</p>${formatMenuHtml(meal.alternative.trim(), recipes)}`);
  }
  if (includeNote && meal.note?.trim()) {
    parts.push(`<p class="meal-note">NOTE: ${formatRichText(meal.note.trim())}</p>`);
  }
  return parts.join('');
};

export const buildDayTableHtml = (day: DietDocumentDay, recipes: DietDocumentRecipe[] = []): string => {
  const menuHtml = (meal: DietDocumentMeal) => buildMenuHtml(meal, recipes);
  const notes = toBulletList(day.notes);
  const done = new Set<CompulsoryRow>();
  return `
  <table class="day">
    <thead>
      <tr>
        <th class="day-name">${escapeHtml(day.label.toUpperCase())}${day.dates ? `<span class="day-dates">(${escapeHtml(day.dates)})</span>` : ''}</th>
        <th class="time-head">TIME</th>
        <th>MENU</th>
      </tr>
    </thead>
    <tbody>
      ${day.meals
        .map(
          (m) => `
      <tr>
        <td class="period">${escapeHtml((m.period || '').toUpperCase())}</td>
        <td class="time">${formatRichText(m.time || '')}</td>
        <td class="menu">${menuHtml(m)}</td>
      </tr>${compulsoryRowHtml(m.period, m.note || '', 3, done)}`,
        )
        .join('')}
      ${notes.length ? `
      <tr class="note-row">
        <td class="note-label" colspan="2">NOTE:</td>
        <td><ul class="bullets">${notes.map((n) => `<li>${linkRecipes(formatDayNote(n), recipes)}</li>`).join('')}</ul></td>
      </tr>` : ''}
    </tbody>
  </table>`;
};

// ---------------------------------------------------------------------------
// Open format
// ---------------------------------------------------------------------------

const WEEKDAY = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*$/i;

/** "Monday (17 Oct)" -> "MON", "Day 2 (18 Oct)" -> "DAY 2"; dates stay out of inline labels. */
const shortDayLabel = (day: DietDocumentDay) => {
  const name = day.label.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const weekday = name.match(WEEKDAY);
  return (weekday ? weekday[1] : name).toUpperCase();
};

// Weekdays follow the clinic's "MON-WED-FRI"; anything else is comma-separated.
const daysPrefix = (days: DietDocumentDay[]) => {
  const labels = days.map(shortDayLabel);
  const joined = labels.every((l) => WEEKDAY.test(l)) ? labels.join('-') : labels.join(', ');
  return `<strong>${escapeHtml(joined)}:</strong> `;
};

/**
 * Groups items (one per day) by a key, keeping first-seen order. Days without
 * an item are skipped. Returns each distinct item with the days it applies to.
 */
const groupByDay = <T>(days: DietDocumentDay[], pick: (d: DietDocumentDay) => T | undefined, key: (t: T) => string) => {
  const groups: { item: T; days: DietDocumentDay[] }[] = [];
  const index = new Map<string, number>();
  days.forEach((d) => {
    const item = pick(d);
    if (item === undefined) return;
    const k = key(item);
    if (!index.has(k)) {
      index.set(k, groups.length);
      groups.push({ item, days: [] });
    }
    groups[index.get(k)!].days.push(d);
  });
  return groups;
};

const normPeriod = (p: string) => (p || '').trim().toLowerCase();

/** One MEAL TYPE / TIME / MENU table for the whole plan. */
export const buildOpenTableHtml = (days: DietDocumentDay[], recipes: DietDocumentRecipe[] = []): string => {
  // Meal types in plan order, across all days.
  const periods: string[] = [];
  days.forEach((d) => d.meals.forEach((m) => {
    if (m.period?.trim() && !periods.some((p) => normPeriod(p) === normPeriod(m.period))) periods.push(m.period);
  }));
  const mealOf = (d: DietDocumentDay, period: string) => d.meals.find((m) => normPeriod(m.period) === normPeriod(period));
  // A prefix is only needed when something differs between days.
  const label = (groupDays: DietDocumentDay[]) => (groupDays.length === days.length ? '' : daysPrefix(groupDays));

  const done = new Set<CompulsoryRow>();
  const rows = periods.map((period) => {
    const menus = groupByDay(
      days,
      (d) => mealOf(d, period),
      (m) => [m.menu, m.alternative, m.serving].map((v) => (v || '').trim()).join('\u0000'),
    ).filter((g) => g.item.menu?.trim() || g.item.alternative?.trim());
    if (!menus.length) return '';
    const menuCell = menus
      .map((g) => buildMenuHtml(g.item, recipes, false, label(g.days)))
      .join('<p class="alt-or">OR</p>');
    const times = groupByDay(days, (d) => mealOf(d, period)?.time?.trim() || undefined, (t) => t);
    const timeCell = times.length === 1
      ? formatRichText(times[0].item)
      : times.map((t) => `${daysPrefix(t.days)}${formatRichText(t.item)}`).join('<br/>');
    const notes = groupByDay(days, (d) => mealOf(d, period)?.note?.trim() || undefined, (n) => n);
    const noteRows = notes
      .map((n) => `<tr class="banner-row"><td colspan="3">${label(n.days)}${linkRecipes(formatRichText(n.item), recipes)}</td></tr>`)
      .join('');
    return `
      <tr>
        <td class="period">${escapeHtml(period.toUpperCase())}</td>
        <td class="time">${timeCell}</td>
        <td class="menu">${menuCell}</td>
      </tr>${noteRows}${compulsoryRowHtml(period, notes.map((n) => n.item).join('\n'), 3, done)}`;
  });

  // Each distinct day NOTE once, labelled with the days it applies to.
  const noteDays = new Map<string, DietDocumentDay[]>();
  days.forEach((d) => toBulletList(d.notes).forEach((n) => {
    const list = noteDays.get(n) ?? [];
    if (!list.includes(d)) list.push(d);
    noteDays.set(n, list);
  }));
  const notesHtml = [...noteDays]
    .map(([note, noteFor]) => `<li>${label(noteFor)}${linkRecipes(formatDayNote(note), recipes)}</li>`)
    .join('');

  return `
  <table class="day open-table">
    <thead>
      <tr>
        <th class="meal-head">MEAL TYPE</th>
        <th class="time-head">TIME</th>
        <th>MENU</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
      ${notesHtml ? `
      <tr class="note-row">
        <td class="note-label" colspan="2">NOTE:</td>
        <td><ul class="bullets">${notesHtml}</ul></td>
      </tr>` : ''}
    </tbody>
  </table>`;
};

// Portrait page and the Open format table styling; appended after STYLES so
// its @page rule wins.
const OPEN_FORMAT_STYLES = `
  <style>
    @page { size: 8.5in 11in; margin: 0.3in; }
    table.layout > tbody > tr > td { padding: 0 0.45in; }
    .intro .session { margin-left: -0.25in; }
    table.open-table th { text-decoration: none; }
    table.open-table th.meal-head { width: 22%; }
    table.open-table th.time-head { width: 17%; }
    table.open-table td.period { vertical-align: middle; }
    table.open-table td.time { vertical-align: middle; }
    table.open-table tr.banner-row td { background: #DDEBF7; font-weight: 700; text-align: center; }
  </style>`;

export const buildGuidelinesHtml = (images: { plate: string; bowls: string }): string => `
  <div class="keep-together">
    <p class="plate-heading">HERE I AM SHOWING YOU HOW OUR LUNCH &amp; DINNER PLATE SHOULD LOOK LIKE ☺:-</p>
    ${images.plate ? `<img class="plate-img" src="${images.plate}" alt="Food plate guide" />` : ''}
  </div>
  <div class="guidelines">
    <h2>*NOTE*</h2>
    <h3>1. KINDLY MAINTAIN PORTION SIZES AND CHEW THE MEALS WELL. Here’s why:</h3>
    <p class="lead">The reason is that it takes about 20 minutes for our brains to register that we’re full. If we eat fast, we can continue eating past the point where we’re full. If we eat slowly, we have time to realize we’re full, and stop on time. Hence, now eating slowly should be a part of your new lifestyle.</p>
    <h3>2. MEASUREMENTS:</h3>
    ${bullets(STANDARD_MEASUREMENTS, false)}
    <h3>3. POINTERS:</h3>
    ${bullets(STANDARD_POINTERS, false)}
    ${images.bowls ? `<img class="bowls-img" src="${images.bowls}" alt="Bowl sizes: 1 katori = 100 ml, 1 bowl = 200 ml" />` : ''}
  </div>`;

// "Watch on YouTube" reads better in print than a long share URL.
const videoLabel = (url: string) =>
  /youtu\.?be/i.test(url) ? 'Watch on YouTube' : /instagram\.com/i.test(url) ? 'Watch on Instagram' : url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

/** Imported guidelines (e.g. Hives & Psoriasis), each starting on a new page. */
export const buildGuidelineSectionsHtml = (guidelines: { title: string; html: string }[] = []): string =>
  guidelines
    .map(
      (g) => `
  <div class="diet-guideline">
    <h2>${escapeHtml(g.title.toUpperCase())}</h2>
    <div class="guideline-body">${g.html}</div>
  </div>`,
    )
    .join('');

export const buildRecipesHtml = (recipes: DietDocumentRecipe[]): string =>
  recipes.length
    ? `
  <div class="recipes">
    <h2>RECIPES</h2>
    ${recipes
      .map(
        (r, i) => `
      <div class="recipe" id="recipe-${i}">
        <h3>${escapeHtml(r.name)}</h3>
        ${r.ingredients ? `<div class="block"><strong>Ingredients:</strong>\n${escapeHtml(r.ingredients)}</div>` : ''}
        ${r.instructions ? `<div class="block"><strong>Method:</strong>\n${escapeHtml(r.instructions)}</div>` : ''}
        ${r.remarks ? `<div class="block"><strong>Remarks:</strong>\n${escapeHtml(r.remarks)}</div>` : ''}
        ${r.links?.length ? `<div class="block"><strong>Recipe video:</strong> ${r.links
          .map((l) => `<a href="${escapeHtml(l)}">${escapeHtml(videoLabel(l))}</a>`)
          .join(' &nbsp;|&nbsp; ')}</div>` : ''}
      </div>`,
      )
      .join('')}
  </div>`
    : '';

/** Client-facing nutrition section: average per day plus each day's totals. */
export const buildNutritionSummaryHtml = (summary: {
  days: { label: string; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } }[];
  average: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
}): string => {
  const kcal = (n: number) => Math.round(n).toLocaleString('en-IN');
  const g = (n: number) => `${Math.round(n)} g`;
  const cells = (t: typeof summary.average) =>
    `<td class="num">${kcal(t.calories)}</td><td class="num">${g(t.protein_g)}</td><td class="num">${g(t.carbs_g)}</td><td class="num">${g(t.fat_g)}</td><td class="num">${g(t.fiber_g)}</td>`;
  const showAverage = summary.days.length > 1;
  return `
  <div class="extra nutrition keep-together">
    <h2>NUTRITIONAL VALUE OF YOUR PLAN</h2>
    <table class="day">
      <thead>
        <tr>
          <th class="day-name">DAY</th>
          <th>CALORIES (kcal)</th><th>PROTEIN</th><th>CARBS</th><th>FAT</th><th>FIBRE</th>
        </tr>
      </thead>
      <tbody>
        ${summary.days.map((d) => `<tr><td class="period">${escapeHtml(d.label.toUpperCase())}</td>${cells(d.totals)}</tr>`).join('')}
        ${showAverage ? `<tr class="note-row"><td class="note-label">AVERAGE PER DAY</td>${cells(summary.average)}</tr>` : ''}
      </tbody>
    </table>
    <p class="nutrition-note">These are approximate values for the main meals in your plan (alternatives not included). Actual values vary with recipes, oil and portion sizes.</p>
  </div>
  <style>
    .nutrition table.day { margin-bottom: 0.12in; }
    .nutrition td.num { text-align: center; }
    .nutrition .nutrition-note { font-style: italic; font-size: 11.5px; margin-bottom: 0.4in; }
  </style>`;
};

/** Wraps body HTML in the clinic page shell (frame, logo, footer, repeating spacers). */
export const wrapDocument = (title: string, bodyHtml: string, logoUrl: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="page-frame"></div>
  <div class="page-logo">${logoUrl ? `<img src="${logoUrl}" alt="Bounce The Pound" />` : ''}</div>
  ${footerHtml()}
  <table class="layout">
    <thead><tr><td><div class="space-top"></div></td></tr></thead>
    <tfoot><tr><td><div class="space-bottom"></div></td></tr></tfoot>
    <tbody><tr><td>
      ${bodyHtml}
    </td></tr></tbody>
  </table>
</body>
</html>`;

export interface DocumentAssets {
  logo: string;
  plate: string;
  bowls: string;
}

export const buildDietPlanHtml = (input: DietDocumentInput, assets: DocumentAssets): string => {
  const recipes = input.recipes || [];
  const open = input.format === 'open';
  const body = `
    ${open ? OPEN_FORMAT_STYLES : ''}
    ${buildIntroHtml(input.header)}
    ${buildInfoTableHtml(input.clientName, input.header)}
    <div class="diet-start">
      ${input.dietTitle?.trim() ? `<p class="diet-title">${escapeHtml(input.dietTitle.trim().toUpperCase())}</p>` : ''}
      ${open ? buildOpenTableHtml(input.days, recipes) : input.days.map((d) => buildDayTableHtml(d, recipes)).join('')}
    </div>
    ${input.extraSectionsHtml || ''}
    ${buildGuidelineSectionsHtml(input.guidelines)}
    ${input.includeGuidelines === false ? '' : buildGuidelinesHtml(assets)}
    ${buildRecipesHtml(recipes)}`;
  return wrapDocument(input.documentTitle, body, assets.logo);
};

// ---------------------------------------------------------------------------
// mapping from saved plan data (ai_plan_data) + client
// ---------------------------------------------------------------------------

export const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Weight Loss',
  weight_gain: 'Weight Gain',
  maintain: 'Maintain Weight',
  muscle_building: 'Muscle Building',
  disease_management: 'Disease Management',
};

export const DIET_PREFERENCE_LABELS: Record<string, string> = {
  vegetarian: 'Vegetarian',
  'non-vegetarian': 'Non-Vegetarian',
  vegan: 'Vegan',
  eggetarian: 'Eggetarian',
};

// Loose shapes so both the generator state and raw ai_plan_data rows fit.
interface PlanLike {
  planName?: string;
  dietTitle?: string;
  startDate?: string;
  editableStartDate?: string;
  editableDayCount?: string;
  importantNotes?: string[];
  supplements?: string;
  hiddenSections?: string[];
  documentHeader?: DietDocumentHeader;
  dayGroups?: Array<{
    label?: string;
    dates?: string;
    dayNotes?: string[];
    meals?: Array<{ period?: string; time?: string; foodPlan?: string; alternative?: string; notes?: string; servingUnit?: string; servingQty?: number }>;
  }>;
}

interface ClientLike {
  name?: string | null;
  weight?: number | null;
  goal?: string | null;
  diet_preference?: string | null;
  health_conditions?: string[] | null;
}

const addDaysIso = (iso: string, days: number): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Header values derived from the client and plan, before any manual edits. */
export const getDefaultDocumentHeader = (
  plan: PlanLike,
  client: ClientLike | null | undefined,
  opts: { sessionNo?: string | number; startDate?: string; dayCount?: number } = {},
): DietDocumentHeader => {
  const hidden = new Set(plan.hiddenSections || []);
  const start = opts.startDate || plan.editableStartDate || plan.startDate || '';
  const dayCount = opts.dayCount || parseInt(plan.editableDayCount || '') || 7;
  return {
    sessionNo: opts.sessionNo !== undefined ? String(opts.sessionNo) : '',
    date: start,
    followUpDate: start ? addDaysIso(start, dayCount) : '',
    weight: client?.weight ? `${client.weight} kgs` : '',
    caseText: (client?.health_conditions || []).join(' + '),
    bloodParameters: '',
    allergies: '',
    triggers: '',
    eliminations: [],
    dietType: client?.diet_preference
      ? [DIET_PREFERENCE_LABELS[client.diet_preference] ?? client.diet_preference]
      : [],
    goals: client?.goal ? [GOAL_LABELS[client.goal] ?? client.goal] : [],
    thingsToRemember: hidden.has('importantNotes') ? [] : plan.importantNotes || [],
    supplements: hidden.has('supplements') ? [] : toBulletList(plan.supplements || ''),
  };
};

/** Defaults overlaid with whatever the nutritionist edited (plan.documentHeader). */
export const resolveDocumentHeader = (
  plan: PlanLike,
  client: ClientLike | null | undefined,
  opts: { sessionNo?: string | number; startDate?: string; dayCount?: number } = {},
): DietDocumentHeader => {
  const out: DietDocumentHeader = getDefaultDocumentHeader(plan, client, opts);
  const saved = plan.documentHeader || {};
  (Object.keys(saved) as (keyof DietDocumentHeader)[]).forEach((k) => {
    if (saved[k] !== undefined) (out as Record<string, unknown>)[k] = saved[k];
  });
  return out;
};

export const resolveDietTitle = (plan: PlanLike, client: ClientLike | null | undefined): string => {
  if (plan.dietTitle !== undefined) return plan.dietTitle;
  return client?.goal ? `${GOAL_LABELS[client.goal] ?? client.goal} diet` : 'Diet plan';
};

export const planToDocumentDays = (plan: PlanLike): DietDocumentDay[] =>
  (plan.dayGroups || []).map((g) => ({
    label: g.label || '',
    dates: g.dates,
    notes: g.dayNotes || [],
    meals: (g.meals || []).map((m) => ({
      period: m.period || '',
      time: m.time || '',
      menu: m.foodPlan || '',
      alternative: m.alternative,
      note: m.notes,
      serving: formatServing(m.servingUnit, m.servingQty),
    })),
  }));

// ---------------------------------------------------------------------------
// asset loading + printing
// ---------------------------------------------------------------------------

const toDataUrl = async (path: string): Promise<string> => {
  try {
    const res = await fetch(path);
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

// The print window is about:blank, so images are inlined as data URLs.
export const loadDocumentAssets = async (): Promise<DocumentAssets> => {
  const [logo, plate, bowls] = await Promise.all([
    toDataUrl('/logo.png'),
    toDataUrl('/diet-plan-food-plate.jpg'),
    toDataUrl('/diet-plan-bowl-sizes.jpg'),
  ]);
  return { logo, plate, bowls };
};

/** Opens the document in a new window and starts the browser's print / save-as-PDF dialog. */
export const printHtmlDocument = (html: string, title: string): boolean => {
  const win = window.open('', '_blank');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.title = title;
  win.document.close();
  const startPrint = () => setTimeout(() => win.print(), 300);
  if (win.document.readyState === 'complete') startPrint();
  else win.addEventListener('load', startPrint, { once: true });
  return true;
};

export const printDietPlan = async (input: DietDocumentInput): Promise<boolean> => {
  const assets = await loadDocumentAssets();
  return printHtmlDocument(buildDietPlanHtml(input, assets), input.documentTitle);
};

/** Short documents (important notes, one-pager) in the same page shell. */
export const printDietDocumentSection = async (opts: {
  documentTitle: string;
  clientName: string;
  header: DietDocumentHeader;
  /** Show the full info table on top (otherwise just Name). */
  fullInfoTable?: boolean;
  sectionTitle: string;
  sectionHtml: string;
}): Promise<boolean> => {
  const assets = await loadDocumentAssets();
  const header = opts.fullInfoTable ? opts.header : {};
  const body = `
    ${buildIntroHtml(opts.header)}
    ${buildInfoTableHtml(opts.clientName, header)}
    <div class="extra">
      <h2>${escapeHtml(opts.sectionTitle)}</h2>
      ${opts.sectionHtml}
    </div>`;
  return printHtmlDocument(wrapDocument(opts.documentTitle, body, assets.logo), opts.documentTitle);
};

export const printImportantNotes = (clientName: string, header: DietDocumentHeader, notes: string[]) =>
  printDietDocumentSection({
    documentTitle: `Important Notes — ${clientName}`,
    clientName,
    header,
    sectionTitle: 'IMPORTANT NOTES',
    sectionHtml: `
      <table class="info">
        <tr><td class="label">NOTE:</td><td class="value">${bullets(toBulletList(notes))}</td></tr>
      </table>`,
  });

/**
 * One-pager: every day side by side (meal rows × day columns) in the same
 * table styling, with each day's NOTE bullets as the last row.
 */
export const printOnePager = (opts: {
  clientName: string;
  header: DietDocumentHeader;
  dietTitle: string;
  days: DietDocumentDay[];
}) => {
  const { days } = opts;
  const mealRows = days[0]?.meals.map((m, i) => ({ period: m.period, time: m.time, i })) || [];
  const cell = (d: DietDocumentDay, i: number) => {
    const m = d.meals[i];
    if (!m) return '';
    let html = formatRichText(m.menu || '');
    if (m.serving) html += `<br/><strong>Portion:</strong> ${escapeHtml(m.serving)}`;
    if (m.alternative?.trim() && m.alternative.trim() !== '-') html += `<br/><strong>OR</strong><br/>${formatRichText(m.alternative.trim())}`;
    return html;
  };
  const hasNotes = days.some((d) => toBulletList(d.notes).length);
  const done = new Set<CompulsoryRow>();
  const table = `
    <table class="day one-pager">
      <thead>
        <tr>
          <th class="day-name">MEAL</th>
          <th class="time-head">TIME</th>
          ${days.map((d) => `<th>${escapeHtml(d.label.toUpperCase())}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${mealRows
          .map(
            (r) => `
        <tr>
          <td class="period">${escapeHtml((r.period || '').toUpperCase())}</td>
          <td class="time">${formatRichText(r.time || '')}</td>
          ${days.map((d) => `<td class="menu">${cell(d, r.i)}</td>`).join('')}
        </tr>${compulsoryRowHtml(r.period, days.map((d) => d.meals[r.i]?.note || '').join('\n'), days.length + 2, done)}`,
          )
          .join('')}
        ${hasNotes ? `
        <tr class="note-row">
          <td class="note-label" colspan="2">NOTE:</td>
          ${days.map((d) => `<td>${bullets(toBulletList(d.notes))}</td>`).join('')}
        </tr>` : ''}
      </tbody>
    </table>
    <style>
      table.one-pager { font-size: ${days.length > 4 ? 10 : 11.5}px; }
      table.one-pager td, table.one-pager th { padding: 5px 6px; }
      table.one-pager th.day-name { width: 11%; }
      table.one-pager th.time-head { width: 8%; }
    </style>`;
  return printDietDocumentSection({
    documentTitle: `One page plan — ${opts.clientName}`,
    clientName: opts.clientName,
    header: opts.header,
    sectionTitle: opts.dietTitle || 'Diet plan',
    sectionHtml: table,
  });
};
