// Import a client profile from an already-filled assessment form (the clinic's
// "NUTRITIONAL & HEALTH ASSESSMENT FORM", Word or PDF) without AI.
//
// Both file types are first turned into the same shape — table rows of cells,
// each cell a list of items (text, bold, bullet) — plus the loose lines outside
// the tables. The form's tick-box questions say "please BOLD/ TICK the option",
// so a bold (or ticked) option is a chosen answer. Questions are found by their
// label, so extra or reordered questions don't break the import; everything is
// kept in the answers, and the known ones also fill the client profile.
import mammoth from 'mammoth';
import { pageRows, toLines, type Cell as PdfCell, type PdfPage } from '@/lib/planPdfImport';

// ---------------------------------------------------------------------------
// Common shape
// ---------------------------------------------------------------------------

interface FormItem {
  text: string;
  bold: boolean;
  /** A tick-box option (list bullet). */
  bullet: boolean;
}
type FormCell = FormItem[];
interface FormDoc {
  rows: FormCell[][];
  /** Text outside the tables, in order (goals / special requests / lab tests). */
  lines: string[];
}

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const TICK = /[✓✔☑✅]/;

// ---------------------------------------------------------------------------
// Word (.docx): mammoth HTML keeps tables, list items and bold.
// ---------------------------------------------------------------------------

const boldIn = (el: Element) =>
  [...el.querySelectorAll('strong, b')].some((b) => clean(b.textContent || '') !== '');

const docxCellItems = (td: Element): FormCell => {
  const copy = td.cloneNode(true) as Element;
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const blocks = [...copy.querySelectorAll('li, p')].filter((b) => !b.querySelector('li, p'));
  const items = (blocks.length ? blocks : [copy]).flatMap((b) => {
    const bullet = b.tagName === 'LI';
    const bold = boldIn(b);
    return (b.textContent || '').split('\n').map((t) => ({ text: clean(t), bold, bullet }));
  });
  return items.filter((i) => i.text);
};

export const docxHtmlToForm = (html: string): FormDoc => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const rows: FormCell[][] = [];
  doc.querySelectorAll('table').forEach((table) => {
    table.querySelectorAll('tr').forEach((tr) => {
      if (tr.closest('table') !== table) return;
      const cells = [...tr.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH').map(docxCellItems);
      rows.push(cells);
    });
  });
  const lines = [...doc.body.querySelectorAll('p, li')]
    .filter((el) => !el.closest('table'))
    .map((el) => clean(el.textContent || ''))
    .filter(Boolean);
  return { rows, lines };
};

// ---------------------------------------------------------------------------
// PDF: the bordered table rows (same reader as the diet plan import).
// ---------------------------------------------------------------------------

const pdfCellItems = (cell: PdfCell): FormCell => {
  const items: FormItem[] = [];
  const hasBullets = cell.lines.some((l) => l.bullet);
  for (const line of cell.lines) {
    const text = line.text.replace(/^([o●•▪◦])\s+/, '');
    if (!hasBullets) {
      // A written answer: wrapped lines are one answer.
      if (items.length) {
        items[0].text = clean(`${items[0].text} ${text}`);
        items[0].bold ||= line.boldText;
      } else items.push({ text, bold: line.boldText, bullet: false });
    } else if (line.bullet || !items.length) {
      items.push({ text, bold: line.boldText, bullet: line.bullet });
    } else {
      // An option that wrapped onto the next line.
      const last = items[items.length - 1];
      last.text = clean(`${last.text} ${text}`);
      last.bold ||= line.boldText;
    }
  }
  return items.filter((i) => i.text);
};

export const pdfPagesToForm = (pages: PdfPage[]): FormDoc => {
  const rows: FormCell[][] = [];
  const lines: string[] = [];
  pages.forEach((page, i) => {
    const pageTableRows = pageRows(page, i + 1);
    for (const row of pageTableRows) {
      const cells = row.cells.map(pdfCellItems);
      const prev = rows[rows.length - 1];
      // A row cut by a page break carries on without its label.
      if (prev && !cells[0]?.length && cells.some((c) => c.length) && prev.length === cells.length) {
        cells.forEach((c, ci) => prev[ci].push(...c));
        continue;
      }
      rows.push(cells);
    }
    const inTable = (t: PdfPage['texts'][number]) =>
      pageTableRows.some((r) => t.y > r.y0 && t.y - t.size * 0.35 < r.y1 && t.x >= r.left - 3 && t.x <= r.right + 3);
    toLines(page.texts.filter((t) => !inTable(t))).forEach((l) => lines.push(clean(l.text)));
  });
  return { rows, lines };
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const labelOf = (cell: FormCell | undefined) => clean((cell || []).map((i) => i.text).join(' ')).replace(/:\s*$/, '');

const isNone = (s: string) => /^(none|nil|na|n\/a|no|-+|nothing|not applicable|don'?t know|don’t know)\.?$/i.test(s.trim());
// "Others, please mention ____ migraine" -> "migraine"; blank -> ''.
const othersText = (s: string) =>
  /^others?\b/i.test(s) ? s.replace(/^others?,?\s*(please mention)?[\s_:-]*/i, '').replace(/_+/g, '').trim() : s;

type Answer = string | string[];

/** A cell's answer: the chosen (bold / ticked) options, or the written text. */
const answerOf = (cell: FormCell): Answer => {
  if (cell.some((i) => i.bullet)) {
    return cell
      .filter((i) => i.bold || TICK.test(i.text))
      .map((i) => othersText(i.text.replace(TICK, '').trim()))
      .filter(Boolean);
  }
  return clean(cell.map((i) => i.text).join(' '));
};

const answerText = (a: Answer | undefined) => (Array.isArray(a) ? a.join(', ') : a || '');

// Grid tables: header label (normalised, prefix) -> section name.
const GRIDS: { header: string; section: string }[] = [
  { header: 'medicinename', section: 'Medications' },
  { header: 'supplementname', section: 'Nutritional supplements' },
  { header: 'typeofexercise', section: 'Exercise' },
  { header: 'meal', section: '24-hour diet recall' },
];

// The question that opens each section of the form.
const SECTION_STARTS: { label: string; section: string }[] = [
  { label: 'name', section: 'Personal information' },
  { label: 'height', section: 'Anthropometric measurements' },
  { label: 'heartrelatedproblem', section: 'Medical history' },
  { label: 'eatinghabits', section: 'Nutritional analysis' },
  { label: 'anyfoodaversions', section: 'Food specifications' },
];

const MEDICAL_GROUPS = ['heartrelatedproblem', 'diabetes', 'pcos', 'thyroid', 'kidneydisorder', 'gutissue'];

export interface AssessmentProfile {
  name: string;
  phone: string;
  email: string;
  address: string;
  /** yyyy-mm-dd */
  date_of_birth: string;
  age: number | null;
  gender: '' | 'male' | 'female' | 'other';
  /** cm */
  height: number | null;
  /** kg */
  weight: number | null;
  diet_preference: '' | 'vegetarian' | 'non-vegetarian' | 'vegan' | 'eggetarian';
  /** Only when the written goal clearly says so. */
  goal: '' | 'weight_loss' | 'weight_gain' | 'muscle_building';
  health_conditions: string[];
  supplements: string;
  notes: string;
}

export interface ImportedAssessment {
  profile: AssessmentProfile;
  /** Every answer by section, for the client's assessment form record. */
  sections: Record<string, Record<string, Answer> | Record<string, string>[]>;
  /** As written on the form, for the preview ("5’10", "68 kg"). */
  raw: { height: string; weight: string; dob: string };
  answerCount: number;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "18-May-1996", "31/08/2004", "18 Sept 1995" -> "1996-05-18"; '' when unreadable. */
export const parseDob = (s: string): string => {
  const t = s.trim().toLowerCase();
  let d: number, m: number, y: number;
  let match = /^(\d{1,2})[/.\-\s]+(\d{1,2})[/.\-\s]+(\d{2,4})$/.exec(t);
  if (match) [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if ((match = /^(\d{1,2})(?:st|nd|rd|th)?[\s/.\-,]+([a-z]{3,})[\s/.\-,]+(\d{2,4})$/.exec(t)))
    [d, m, y] = [Number(match[1]), MONTHS.indexOf(match[2].slice(0, 3)) + 1, Number(match[3])];
  else if ((match = /^([a-z]{3,})[\s.]+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(t)))
    [d, m, y] = [Number(match[2]), MONTHS.indexOf(match[1].slice(0, 3)) + 1, Number(match[3])];
  else return '';
  if (y < 100) y += y > new Date().getFullYear() % 100 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
};

/** "5’10", "5 feet 3 inch", "5.3 ft", "155", "1.6 m" -> cm (one decimal). */
export const parseHeightCm = (s: string): number | null => {
  const t = s.toLowerCase().replace(/[’′‘]/g, "'").replace(/[”″“]/g, '"');
  const feet = /(\d+)\s*(?:'|ft|feet|foot)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inch|inches)?)?/.exec(t);
  if (feet) return Math.round((Number(feet[1]) * 30.48 + Number(feet[2] || 0) * 2.54) * 10) / 10;
  const num = /(\d+(?:\.\d+)?)/.exec(t);
  if (!num) return null;
  const n = Number(num[1]);
  if (/\bm\b|metre|meter/.test(t) && n < 3) return Math.round(n * 1000) / 10;
  // "5.3" is how 5 ft 3 in is often written.
  if (n >= 3 && n < 8) {
    const [ft, inch = '0'] = num[1].split('.');
    return Math.round((Number(ft) * 30.48 + Number(inch) * 2.54) * 10) / 10;
  }
  return n >= 50 && n <= 250 ? n : null;
};

/** "68 kg", "72", "150 lbs" -> kg. */
export const parseWeightKg = (s: string): number | null => {
  const num = /(\d+(?:\.\d+)?)/.exec(s);
  if (!num) return null;
  const n = Number(num[1]);
  const kg = /lb|pound/i.test(s) ? n * 0.4536 : n;
  return kg >= 2 && kg <= 400 ? Math.round(kg * 10) / 10 : null;
};

const yearsSince = (iso: string) => {
  const dob = new Date(`${iso}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate())) age--;
  return age;
};

/** Reads the answers off the form and fills the client profile. */
export const extractAssessment = (form: FormDoc): ImportedAssessment => {
  const sections: ImportedAssessment['sections'] = {};
  const answers = new Map<string, Answer>();
  let section = 'Personal information';
  let grid: { section: string; columns: string[] } | null = null;

  for (const row of form.rows) {
    const texts = row.map(labelOf);
    if (texts.every((t) => !t)) continue;

    // A grid table's header row starts its rows (medications, exercise, diet recall).
    const gridStart = GRIDS.find((g) => norm(texts[0]).startsWith(g.header) && row.length >= 3);
    if (gridStart) {
      grid = { section: gridStart.section, columns: texts.map((t) => t.replace(/\s*\(.*?\)\s*/g, ' ').trim()) };
      sections[grid.section] = [];
      continue;
    }
    // Rows stay in the grid until the next section's question (a row can have
    // merged cells, e.g. "Wake up time | 6 am").
    const nextSection = SECTION_STARTS.some((s) => norm(texts[0]).startsWith(s.label) && (s.label !== 'name' || norm(texts[0]) === 'name'));
    if (grid && !nextSection && row.length >= 2 && row.length <= grid.columns.length) {
      const entry: Record<string, string> = {};
      texts.forEach((t, i) => {
        if (t && !/^[-_]+$/.test(t)) entry[grid!.columns[i] || `Column ${i + 1}`] = t;
      });
      // A listed exercise / meal with nothing filled in beside it isn't an answer.
      if (Object.keys(entry).length > (grid.section === 'Medications' || grid.section === 'Nutritional supplements' ? 0 : 1)) {
        (sections[grid.section] as Record<string, string>[]).push(entry);
      }
      continue;
    }
    grid = null;

    // Label / answer pairs, up to two per row ("Age: | 30 | Gender: | Male").
    for (let i = 0; i + 1 < row.length; i += 2) {
      const label = texts[i];
      if (!label || /please bold|tick the option/i.test(label)) continue;
      const key = norm(label);
      const start = SECTION_STARTS.find((s) => key.startsWith(s.label) && (s.label !== 'name' || key === 'name'));
      if (start) section = start.section;
      const answer = answerOf(row[i + 1]);
      answers.set(key, answer);
      const bucket = (sections[section] ??= {}) as Record<string, Answer>;
      bucket[label.replace(/\s+/g, ' ')] = answer;
    }
  }

  // Goals / special requests / lab tests: loose lines after the tables.
  const closing: Record<string, string> = {};
  const CLOSING = [
    { key: 'Goals', re: /^[●•▪o]?\s*our goals in this journey:?\s*/i },
    { key: 'Special requests', re: /^[●•▪o]?\s*any special requests:?\s*/i },
    { key: 'Recent diagnostic / lab tests', re: /^[●•▪o]?\s*brief account of results of recent diagnostic\/? clinical\/? lab tests:?\s*/i },
  ];
  form.lines.forEach((line, i) => {
    const hit = CLOSING.find((c) => c.re.test(line));
    if (!hit) return;
    const parts = [line.replace(hit.re, '')];
    for (const next of form.lines.slice(i + 1)) {
      if (CLOSING.some((c) => c.re.test(next)) || /^please attach/i.test(next) || /^(dt\.|contact:)/i.test(next)) break;
      parts.push(next);
    }
    const value = clean(parts.join(' '));
    if (value) closing[hit.key] = value;
  });
  if (Object.keys(closing).length) sections['Goals & requests'] = closing;

  // ---- profile ----
  const get = (...keys: string[]) => {
    for (const k of keys) for (const [key, a] of answers) if (key.startsWith(k)) return a;
    return undefined;
  };
  const text = (...keys: string[]) => {
    const t = answerText(get(...keys));
    return isNone(t) ? '' : t;
  };

  const rawDob = text('dob', 'dateofbirth');
  const date_of_birth = parseDob(rawDob);
  const ageText = text('age');
  const age = date_of_birth ? yearsSince(date_of_birth) : /^\d{1,3}/.test(ageText) ? parseInt(ageText, 10) : null;

  const genderText = text('gender').toLowerCase();
  const gender: AssessmentProfile['gender'] = /^f|woman|girl/.test(genderText)
    ? 'female'
    : /^m|^boy/.test(genderText)
      ? 'male'
      : genderText
        ? 'other'
        : '';

  const habits = (get('eatinghabits') as string[] | undefined) ?? [];
  const has = (re: RegExp) => (Array.isArray(habits) ? habits : [habits]).some((h) => re.test(h));
  const diet_preference: AssessmentProfile['diet_preference'] = has(/non[\s-]*veg/i)
    ? 'non-vegetarian'
    : has(/vegan/i)
      ? 'vegan'
      : has(/ovo|egg/i)
        ? 'eggetarian'
        : has(/veg/i)
          ? 'vegetarian'
          : '';

  const conditions: string[] = [];
  for (const group of MEDICAL_GROUPS) {
    const chosen = get(group);
    for (const c of Array.isArray(chosen) ? chosen : []) {
      if (!c || isNone(c)) continue;
      conditions.push(group === 'pcos' && !/pcos|pcod/i.test(c) ? `PCOS – ${c}` : c);
    }
  }
  for (const k of ['anychronicillness', 'anyorthopedic']) {
    const t = text(k);
    if (t) conditions.push(t);
  }

  const listRows = (name: string) =>
    ((sections[name] as Record<string, string>[] | undefined) ?? [])
      .filter((r) => Object.values(r)[0] && !isNone(Object.values(r)[0]))
      .map((r) => {
        const [first, ...rest] = Object.values(r);
        return rest.length ? `${first} – ${rest.join(', ')}` : first;
      });
  const supplements = [...listRows('Medications'), ...listRows('Nutritional supplements')].join('\n');

  const notes = [
    closing.Goals && `Goals: ${closing.Goals}`,
    closing['Special requests'] && `Special requests: ${closing['Special requests']}`,
    closing['Recent diagnostic / lab tests'] && `Recent tests: ${closing['Recent diagnostic / lab tests']}`,
    text('anyfoodaversions') && `Food aversions: ${text('anyfoodaversions')}`,
    text('anyprovenfoodallergies') && `Food allergies: ${text('anyprovenfoodallergies')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const rawHeight = text('height');
  const rawWeight = text('weight');
  const phoneText = text('contactno', 'phone', 'mobile');

  const profile: AssessmentProfile = {
    name: text('name').replace(/\s+/g, ' '),
    phone: phoneText.replace(/[^\d+]/g, '').replace(/^(\+?91)?(\d{10})$/, '$2'),
    email: (text('emailid', 'email').match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] || '').toLowerCase(),
    address: text('addresswithpincode', 'address'),
    date_of_birth,
    age: age !== null && age >= 0 && age <= 120 ? age : null,
    gender,
    height: rawHeight ? parseHeightCm(rawHeight) : null,
    weight: rawWeight ? parseWeightKg(rawWeight) : null,
    diet_preference,
    goal: /weight\s*loss|fat\s*loss|lose\s*weight|reduce\s*weight|pre-?pregnancy weight/i.test(closing.Goals || '')
      ? 'weight_loss'
      : /muscle/i.test(closing.Goals || '')
        ? 'muscle_building'
        : /weight\s*gain|gain\s*weight/i.test(closing.Goals || '')
          ? 'weight_gain'
          : '',
    health_conditions: [...new Set(conditions)],
    supplements,
    notes,
  };

  const answerCount = [...answers.values()].filter((a) => (Array.isArray(a) ? a.length : a)).length;
  return { profile, sections, raw: { height: rawHeight, weight: rawWeight, dob: rawDob }, answerCount };
};

/** Reads an assessment form file (.docx or .pdf). */
export async function readAssessmentFile(file: File): Promise<ImportedAssessment> {
  if (/\.docx$/i.test(file.name)) {
    const { value } = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      // Photos in the form aren't needed and would bloat the HTML.
      { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
    );
    return extractAssessment(docxHtmlToForm(value));
  }
  const { readPdfFile } = await import('@/lib/planPdfImport');
  return extractAssessment(pdfPagesToForm(await readPdfFile(file)));
}
