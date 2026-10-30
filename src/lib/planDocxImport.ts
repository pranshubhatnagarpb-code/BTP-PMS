// Import a diet chart template from an existing plan in Word (.docx) without AI.
// Word keeps the plan's table as it is, so this reads it straight from the
// document's HTML (mammoth): the MEAL TYPE / TIME / MENU table (or one table per
// day), full-width rows as the meal's note, and THINGS TO REMEMBER from the
// header table as the template's instructions. Same result shape as planPdfImport.
import mammoth from 'mammoth';
import type { TemplateDay, TemplateMeal } from '@/hooks/useDietChartTemplates';
import { WEEKLY_MENU_LABEL } from '@/lib/manualDietPlan';
import { keepNotes, splitMenu, type ImportedTemplate } from '@/lib/planPdfImport';

const clean = (s: string) => s.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
const BULLET = /^[•●▪◦·-]\s*/;
const SEPARATOR = /^(or|\+|&)$/i;

/** A cell's paragraphs / list items, one per line (line breaks inside a paragraph kept). */
const cellLines = (cell: Element): string[] => {
  const copy = cell.cloneNode(true) as Element;
  copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  const blocks = copy.querySelectorAll('p, li');
  const texts = blocks.length ? [...blocks].map((b) => b.textContent || '') : [copy.textContent || ''];
  return texts
    .flatMap((t) => t.split('\n'))
    .map(clean)
    .filter(Boolean);
};

const cellText = (cell: Element | undefined) => (cell ? cellLines(cell).join(' ') : '');

/** Menu lines in the template format: OR / + on their own lines, upper-cased. */
const menuText = (cell: Element | undefined) =>
  cell ? cellLines(cell).map((l) => (SEPARATOR.test(l) ? l.toUpperCase() : l)).join('\n') : '';

const ownRows = (table: Element) =>
  [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table);
const ownCells = (row: Element) =>
  [...row.children].filter((c) => c.tagName === 'TD' || c.tagName === 'TH');

/** Reads the plan's table(s) out of a .docx file. */
export async function parsePlanDocx(file: File): Promise<ImportedTemplate> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return parsePlanHtml(html);
}

/** The parsing half of parsePlanDocx, on the document's HTML. */
export const parsePlanHtml = (html: string): ImportedTemplate => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const days: TemplateDay[] = [];
  let instructions = '';
  let current: TemplateDay | null = null;

  for (const table of doc.querySelectorAll('table')) {
    const rows = ownRows(table);

    // Header table: THINGS TO REMEMBER becomes the template's instructions.
    for (const row of rows) {
      const cells = ownCells(row);
      if (cells.length === 2 && /things to remember/i.test(cellText(cells[0])) && !instructions) {
        instructions = cellLines(cells[1]).map((l) => l.replace(BULLET, '')).filter(Boolean).join('\n');
      }
    }

    // Plan table: its first row has a MENU column.
    const headerIdx = rows.findIndex((r) => ownCells(r).some((c) => /^menu\b/i.test(cellText(c))));
    if (headerIdx < 0) continue;
    const head = ownCells(rows[headerIdx]).map((c) => cellText(c).toUpperCase());
    const menuIdx = head.findIndex((t) => t.startsWith('MENU'));
    const timeIdx = head.findIndex((t) => t === 'TIME' || t === 'TIMING' || t === 'TIMINGS');
    const first = head[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const day = /^MEAL/.test(first) || !first ? WEEKLY_MENU_LABEL : first.charAt(0) + first.slice(1).toLowerCase();
    if (!(current && current.day === day)) {
      current = { day, meals: [] };
      days.push(current);
    }

    let pendingNotes: string[] = [];
    for (const row of rows.slice(headerIdx + 1)) {
      const cells = ownCells(row);
      const lastMeal = current.meals[current.meals.length - 1] as TemplateMeal | undefined;

      // Full-width row: a note (workout / walk reminder) under the meal above.
      if (cells.length === 1) {
        const lines = keepNotes(cellLines(cells[0]).map((l) => l.replace(BULLET, '')).filter((l) => !/^note:?$/i.test(l)));
        if (!lines.length) continue;
        if (lastMeal) lastMeal.notes = [lastMeal.notes, ...lines].filter(Boolean).join('\n');
        else pendingNotes.push(...lines);
        continue;
      }

      const label = cellText(cells[0]);
      const clock = timeIdx > 0 ? cellText(cells[timeIdx]) : '';
      const menuCell = cells[menuIdx] ?? cells[cells.length - 1];

      // "NOTE:" row of a day table: day notes go under the day's last meal.
      if (/^note:?$/i.test(label)) {
        const notes = keepNotes(cellLines(menuCell).map((l) => l.replace(BULLET, '')));
        if (lastMeal && notes.length) lastMeal.notes = [lastMeal.notes, ...notes].filter(Boolean).join('\n');
        continue;
      }
      const menu = menuText(menuCell);
      if (!label && !menu) continue;

      const parts = splitMenu(menu);
      current.meals.push({
        time: label || clock,
        clock: label ? clock : '',
        meal: parts.meal,
        alternatives: '',
        notes: keepNotes([...pendingNotes, ...parts.notes]).join('\n'),
        ...(parts.serving ?? {}),
      });
      pendingNotes = [];
    }
  }

  const kept = days.filter((d) => d.meals.length);
  return { days: kept, instructions, mealCount: kept.reduce((n, d) => n + d.meals.length, 0) };
};
