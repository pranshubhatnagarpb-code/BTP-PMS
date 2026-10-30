// Import a diet chart template from an existing plan PDF (the clinic's Word ->
// PDF plans, or the PMS's own PDFs) without AI. The plan's table is rebuilt
// from the PDF itself: table borders give the rows and columns, and each piece
// of text goes into the cell it sits in.
//
// - Open format (MEAL TYPE | TIME | MENU): one "Weekly menu" template day.
// - Tabular format (<DAY> | TIME | MENU per day): one template day per table.
// Full-width rows (workout / walk reminders) become the meal's note, OR and +
// lines are kept, and "THINGS TO REMEMBER" from the header becomes the
// template's instructions.
import type { TemplateDay, TemplateMeal } from '@/hooks/useDietChartTemplates';
import { WEEKLY_MENU_LABEL } from '@/lib/manualDietPlan';
import { isCompulsoryLine, isServingUnit } from '@/lib/dietPlanDocument';

// ---------------------------------------------------------------------------
// Page extraction (pdf.js page -> text pieces + table border lines)
// ---------------------------------------------------------------------------

export interface PdfText {
  x: number;
  width: number;
  /** Baseline, from the top of the page. */
  y: number;
  size: number;
  str: string;
  bold: boolean;
}

export interface PdfPage {
  texts: PdfText[];
  /** Horizontal border segments: y, x0, x1. */
  hLines: { y: number; x0: number; x1: number }[];
  /** Vertical border segments: x, y0 (top), y1 (bottom). */
  vLines: { x: number; y0: number; y1: number }[];
}

/* eslint-disable @typescript-eslint/no-explicit-any -- pdf.js page objects */
export async function extractPdfPage(page: any, OPS: Record<string, number>): Promise<PdfPage> {
  const height = page.getViewport({ scale: 1 }).height;
  const ops = await page.getOperatorList();
  const content = await page.getTextContent();

  const boldFont = new Map<string, boolean>();
  const isBold = (fontName: string) => {
    if (!boldFont.has(fontName)) {
      let name = '';
      try {
        name = page.commonObjs.get(fontName)?.name || '';
      } catch {
        // font not resolved — treat as regular
      }
      boldFont.set(fontName, /bold|black|heavy|semibold|demi/i.test(name));
    }
    return boldFont.get(fontName)!;
  };

  const texts: PdfText[] = content.items
    .filter((it: any) => typeof it.str === 'string' && it.str.trim())
    .map((it: any) => ({
      x: it.transform[4],
      width: it.width,
      y: height - it.transform[5],
      size: Math.abs(it.transform[3]) || it.height || 10,
      str: it.str,
      bold: isBold(it.fontName),
    }));

  // Table borders: thin filled rectangles / lines. Their bounding boxes are
  // enough to tell horizontal rules from vertical ones. Paths are drawn in the
  // current transform (Chrome's PDFs scale everything), so it is tracked.
  const hLines: PdfPage['hLines'] = [];
  const vLines: PdfPage['vLines'] = [];
  type Matrix = [number, number, number, number, number, number];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const multiply = (m: Matrix, n: Matrix): Matrix => [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
  const apply = (x: number, y: number): [number, number] => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
  ops.fnArray.forEach((fn: number, i: number) => {
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform) ctm = multiply(ctm, ops.argsArray[i] as Matrix);
    if (fn !== OPS.constructPath) return;
    const mm = ops.argsArray[i]?.[2];
    if (!mm || mm.length < 4) return;
    const [ax, ay] = apply(mm[0], mm[1]);
    const [bx, by] = apply(mm[2], mm[3]);
    const [x0, x1, yb, yt] = [Math.min(ax, bx), Math.max(ax, bx), Math.min(ay, by), Math.max(ay, by)];
    const w = x1 - x0;
    const h = yt - yb;
    if (h < 3 && w > 20) hLines.push({ y: height - (yb + yt) / 2, x0, x1 });
    // Lines running most of the page are a page frame (the plan's double border), not table borders.
    else if (w < 3 && h > 8 && h < height * 0.75) vLines.push({ x: (x0 + x1) / 2, y0: height - yt, y1: height - yb });
  });
  return { texts, hLines, vLines };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Reads every page of a PDF file in the browser. */
export async function readPdfFile(file: File): Promise<PdfPage[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) pages.push(await extractPdfPage(await doc.getPage(n), pdfjs.OPS));
  return pages;
}

// ---------------------------------------------------------------------------
// Table rebuilding
// ---------------------------------------------------------------------------

export interface Line {
  y: number;
  size: number;
  /** Right edge of the line's text. */
  right: number;
  text: string;
  /** Bold text at the start of the line (e.g. "MON- WED:"). */
  boldLead: string;
  allBold: boolean;
  /** Starts with a list bullet ("o", "●"): a tick-box option in a form. */
  bullet: boolean;
  /** Any bold text apart from the bullet (a form's bolded = chosen option). */
  boldText: boolean;
}

export interface Cell {
  x0: number;
  x1: number;
  lines: Line[];
}

export interface Row {
  page: number;
  y0: number;
  y1: number;
  left: number;
  right: number;
  cells: Cell[];
}

const TOL = 3;

const cluster = (values: number[], tol = 1.5) => {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || v - out[out.length - 1] > tol) out.push(v);
  return out;
};

/** Text pieces -> lines (same baseline), left to right. */
// Word's tick-box bullets come through as "o", "", "●" or "•".
const BULLET_GLYPH = /^(o|●|•|▪|◦|\uf0a7|\uf06f)$/;

export const toLines = (texts: PdfText[]): Line[] => {
  const sorted = [...texts].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: PdfText[][] = [];
  for (const t of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last[0].y - t.y) <= Math.max(2, t.size * 0.3)) last.push(t);
    else groups.push([t]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let text = '';
    let boldLead = '';
    let leadOpen = true;
    let prevEnd = -Infinity;
    for (const t of g) {
      const gap = t.x - prevEnd;
      const piece = (text && gap > t.size * 0.15 && !text.endsWith(' ') && !t.str.startsWith(' ') ? ' ' : '') + t.str;
      text += piece;
      if (leadOpen && t.bold) boldLead += piece;
      else leadOpen = false;
      prevEnd = t.x + t.width;
    }
    return {
      y: g[0].y,
      size: Math.max(...g.map((t) => t.size)),
      right: Math.max(...g.map((t) => t.x + t.width)),
      text: text.replace(/\s+/g, ' ').trim(),
      boldLead: boldLead.replace(/\s+/g, ' ').trim(),
      allBold: g.every((t) => t.bold),
      bullet: BULLET_GLYPH.test(g[0].str.trim()) || /^([●•▪◦]|o(?=\s+\S))\s/.test(text.trim()),
      boldText: g.some((t, i) => t.bold && t.str.trim() !== '' && !(i === 0 && BULLET_GLYPH.test(t.str.trim()))),
    };
  });
};

/** One page's bordered table rows (row = band between two horizontal borders). */
export const pageRows = (page: PdfPage, pageNo: number): Row[] => {
  // Real row borders start and end on the table's vertical borders; link
  // underlines inside a cell don't, and would otherwise split rows.
  const borderXs = cluster(page.vLines.map((v) => v.x), 2);
  const onBorder = (x: number) => borderXs.some((b) => Math.abs(b - x) <= TOL);
  const ys = cluster(page.hLines.filter((l) => onBorder(l.x0) && onBorder(l.x1)).map((l) => l.y));
  const rows: Row[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const [ya, yb] = [ys[i], ys[i + 1]];
    if (yb - ya < 6) continue;
    // Borders closer than a few points are one double line, not a sliver of a cell.
    const xs = cluster(page.vLines.filter((v) => v.y0 <= ya + TOL && v.y1 >= yb - TOL).map((v) => v.x), 6);
    if (xs.length < 2) continue;
    const cells: Cell[] = [];
    for (let c = 0; c < xs.length - 1; c++) {
      const [x0, x1] = [xs[c], xs[c + 1]];
      const inCell = page.texts.filter((t) => {
        const cy = t.y - t.size * 0.35;
        const cx = t.x + Math.min(t.width, 4);
        return cy > ya && cy < yb && cx > x0 && cx < x1;
      });
      cells.push({ x0, x1, lines: toLines(inCell) });
    }
    rows.push({ page: pageNo, y0: ya, y1: yb, left: xs[0], right: xs[xs.length - 1], cells });
  }
  return rows;
};

const cellText = (cell: Cell | undefined) => (cell?.lines || []).map((l) => l.text).join(' ').replace(/\s+/g, ' ').trim();

const SEPARATOR = /^(or|\+|&)$/i;

/**
 * Menu cell -> template text: wrapped lines rejoined, one option per line,
 * "OR" / "+" on their own lines (the format the PDF renderer reads back).
 */
const menuText = (cell: Cell | undefined) => {
  const lines = cell?.lines || [];
  const paras: string[] = [];
  let prev: Line | null = null;
  for (const line of lines) {
    const startsOption = /:\s*$/.test(line.boldLead) || /^[A-Z0-9][A-Z0-9 /&,.+\-[\]()]{0,30}:\s/.test(line.text);
    const gap = prev ? line.y - prev.y : 0;
    const newPara =
      !prev || SEPARATOR.test(line.text) || SEPARATOR.test(prev.text) || startsOption || gap > Math.max(line.size, prev.size) * 1.75;
    if (newPara) paras.push(line.text);
    else paras[paras.length - 1] += ` ${line.text}`;
    prev = line;
  }
  return paras
    .map((p) => (SEPARATOR.test(p.trim()) ? p.trim().toUpperCase() : p.trim()))
    .filter(Boolean)
    .join('\n');
};

const BULLET = /^[•●▪◦·-]\s*/;

/**
 * A list cell (THINGS TO REMEMBER, full-width reminders) -> one point per line.
 * A line starts a new point after a bullet, after a paragraph gap, or (left-aligned
 * lists only) when the line above ended short of the cell's edge; otherwise it is
 * the wrapped rest of the point above. Centred rows end short on every line.
 */
const listText = (cell: Cell | undefined, centred = false) => {
  if (!cell) return [];
  const points: string[] = [];
  let prev: Line | null = null;
  const width = cell.x1 - cell.x0;
  for (const line of cell.lines) {
    // Several bullets on one line (some Word exports) are separate points.
    const parts = line.text.split(/\s+(?=[•●▪◦]\s)/);
    parts.forEach((part, i) => {
      const gap = prev ? line.y - prev.y : 0;
      const startsNew =
        !prev ||
        i > 0 ||
        BULLET.test(part) ||
        (prev !== line && gap > Math.max(line.size, prev.size) * 1.75) ||
        (!centred && prev.right < cell.x1 - width * 0.2);
      if (startsNew) points.push(part.replace(BULLET, '').trim());
      else points[points.length - 1] += ` ${part.trim()}`;
    });
    prev = line;
  }
  return points.filter(Boolean);
};

/** "Portion: 2 bowls" -> bowl / 2 (the PMS's own PDFs print the portion this way). */
const parsePortion = (text: string): Pick<TemplateMeal, 'servingUnit' | 'servingQty'> | null => {
  const m = /^portion:\s*(\d+)\s*([a-z]+?)(?:e?s)?$/i.exec(text.trim());
  if (!m) return null;
  const unit = m[2].toLowerCase().replace(/^glass$|^glasse$/, 'glass');
  return isServingUnit(unit) ? { servingUnit: unit, servingQty: Number(m[1]) } : null;
};

/**
 * Menu text -> the meal's own text plus anything that belongs elsewhere: the PMS
 * prints a meal's note ("NOTE: ...") and portion ("Portion: 1 bowl") in the menu cell.
 */
export const splitMenu = (menu: string) => {
  const notes: string[] = [];
  let serving: ReturnType<typeof parsePortion> = null;
  const kept = menu.split('\n').filter((line) => {
    const portion = parsePortion(line);
    if (portion) {
      serving = portion;
      return false;
    }
    const note = /^note:\s*(.+)$/i.exec(line.trim());
    if (note) {
      notes.push(note[1]);
      return false;
    }
    return true;
  });
  return { meal: kept.join('\n'), notes, serving: serving as ReturnType<typeof parsePortion> };
};

/** Note lines worth keeping: reminders every plan gets anyway are left out. */
export const keepNotes = (lines: string[]) => lines.filter((l) => l && !isCompulsoryLine(l));

const near = (a: number, b: number) => Math.abs(a - b) <= TOL * 2;

export interface ImportedTemplate {
  days: TemplateDay[];
  instructions: string;
  /** Meal rows found, for the preview. */
  mealCount: number;
}

/** Rebuilds the diet table(s) from a plan PDF's pages. */
export const parsePlanPdf = (pages: PdfPage[]): ImportedTemplate => {
  const rows = pages.flatMap((p, i) => pageRows(p, i + 1));
  const days: TemplateDay[] = [];
  let instructions = '';

  // Header ("MEAL TYPE | TIME | MENU" or "<DAY> | TIME | MENU") sets the columns.
  let table: { left: number; right: number; time?: [number, number]; menu: [number, number] } | null = null;
  let current: TemplateDay | null = null;
  let pendingNotes: string[] = [];

  for (const row of rows) {
    const texts = row.cells.map(cellText);
    const upper = texts.map((t) => t.toUpperCase());
    const menuIdx = upper.findIndex((t) => t === 'MENU' || t.startsWith('MENU'));
    const timeIdx = upper.findIndex((t) => t === 'TIME' || t === 'TIMING' || t === 'TIMINGS');

    // Header table rows before the plan: keep "THINGS TO REMEMBER" as instructions.
    if (!table && row.cells.length === 2 && /things to remember/i.test(texts[0])) {
      instructions = listText(row.cells[1]).join('\n');
      continue;
    }

    if (menuIdx > 0 && row.cells.length >= 2) {
      // The PMS prints a day's dates under its name: "MONDAY (3 Nov)".
      const first = texts[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
      const label = /^meal/i.test(first) || !first ? WEEKLY_MENU_LABEL : first.replace(/\s+/g, ' ');
      table = {
        left: row.left,
        right: row.right,
        time: timeIdx > 0 ? [row.cells[timeIdx].x0, row.cells[timeIdx].x1] : undefined,
        menu: [row.cells[menuIdx].x0, row.cells[menuIdx].x1],
      };
      // A header repeated on the next page continues the same day / weekly menu.
      const day = label === WEEKLY_MENU_LABEL ? label : label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      if (!(current && current.day === day)) {
        current = { day, meals: [] };
        days.push(current);
      }
      continue;
    }
    if (!table || !current) continue;
    // Rows of other tables (period tracker, food lists...) end the plan table.
    if (!near(row.left, table.left) || !near(row.right, table.right)) {
      table = null;
      continue;
    }

    const lastMeal = current.meals[current.meals.length - 1] as TemplateMeal | undefined;

    // Full-width row: a note (workout / walk reminder) under the meal above.
    if (row.cells.length === 1) {
      const lines = keepNotes(listText(row.cells[0], true).filter((l) => !/^note:?$/i.test(l)));
      if (!lines.length) continue;
      if (lastMeal) lastMeal.notes = [lastMeal.notes, ...lines].filter(Boolean).join('\n');
      else pendingNotes.push(...lines);
      continue;
    }

    // Cells by role: menu = the cell over the MENU column, time = over TIME, label = the rest on the left.
    const menuCell = row.cells.find((c) => c.x0 >= table!.menu[0] - TOL * 2 && c.x0 < table!.menu[1]);
    const timeCell = table.time ? row.cells.find((c) => near(c.x0, table!.time![0]) && c !== menuCell) : undefined;
    const labelCell = row.cells.find((c) => c !== menuCell && c !== timeCell && c.x0 < table!.menu[0]);
    const label = cellText(labelCell);
    const clock = cellText(timeCell);
    const menu = menuText(menuCell);

    // "NOTE:" row of a day table: day notes go under the day's last meal.
    if (/^note:?$/i.test(label)) {
      const notes = (menuCell?.lines || []).map((l) => l.text.replace(/^[•●▪-]\s*/, '')).join('\n');
      if (lastMeal && notes) lastMeal.notes = [lastMeal.notes, notes].filter(Boolean).join('\n');
      continue;
    }
    // Row split across a page break: no label / time, menu continues. A line cut
    // by the break carries on the line above, unless a new option starts.
    if (!label && !clock) {
      if (lastMeal && menu) {
        const [head, ...rest] = menu.split('\n');
        const prevLast = lastMeal.meal.split('\n').pop() || '';
        const startsOption = SEPARATOR.test(head) || SEPARATOR.test(prevLast) || /^[A-Z0-9][A-Z0-9 /&,.+\-[\]()]{0,30}:\s/.test(head);
        lastMeal.meal = startsOption || !lastMeal.meal
          ? [lastMeal.meal, menu].filter(Boolean).join('\n')
          : [`${lastMeal.meal} ${head}`, ...rest].join('\n');
      }
      continue;
    }
    if (!label && !menu) continue;

    const parts = splitMenu(menu);
    const meal: TemplateMeal = {
      time: label || clock,
      clock: label ? clock : '',
      meal: parts.meal,
      alternatives: '',
      notes: keepNotes([...pendingNotes, ...parts.notes]).join('\n'),
      ...(parts.serving ?? {}),
    };
    pendingNotes = [];
    current.meals.push(meal);
  }

  const kept = days.filter((d) => d.meals.length);
  return { days: kept, instructions, mealCount: kept.reduce((n, d) => n + d.meals.length, 0) };
};

// "Session 21_8- Komal.pdf" -> "Session 21 8 Komal"
export const templateNameFromPdf = (fileName: string) =>
  fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();
