// Editing helpers for the daily blocks dialog: rows <-> blocks, validation, and
// turning edited usual blocks into database changes.
import { minutesToTime, timeToMinutes, type RecurringBlock } from '@/lib/appointmentOutcomes';
import type { BlockChanges, DayBlock } from '@/hooks/useRecurringBlocks';

export interface Row {
  key: string;
  id?: string;
  label: string;
  start: string;
  end: string;
  /** Usual blocks only — kept as they are (older blocks may skip some weekdays). */
  weekdays?: number[];
}

export const newKey = () => Math.random().toString(36).slice(2);

export const blocksToRows = (blocks: (DayBlock | RecurringBlock)[]): Row[] =>
  blocks.map((b) => ({
    key: ('id' in b && b.id) || newKey(),
    id: 'id' in b ? b.id : undefined,
    label: b.label,
    start: minutesToTime(b.start),
    end: minutesToTime(b.end),
    weekdays: 'weekdays' in b ? [...b.weekdays] : undefined,
  }));

export const rowProblem = (r: Row) => {
  const start = timeToMinutes(r.start);
  const end = timeToMinutes(r.end);
  if (!r.label.trim()) return 'Add a name';
  if (start === null || end === null) return 'Set both times';
  if (end <= start) return 'End must be after start';
  return null;
};

export const rowsToDayBlocks = (rows: Row[]): DayBlock[] =>
  rows
    .map((r) => ({ label: r.label.trim(), start: timeToMinutes(r.start)!, end: timeToMinutes(r.end)! }))
    .sort((a, b) => a.start - b.start);

const sameBlock = (a: DayBlock, b: DayBlock) => a.label === b.label && a.start === b.start && a.end === b.end;

/** True when a date's edited rows are just the usual blocks again. */
export const matchesUsual = (rows: Row[], usual: DayBlock[]) => {
  const edited = rowsToDayBlocks(rows);
  const base = [...usual].sort((a, b) => a.start - b.start);
  return edited.length === base.length && edited.every((b, i) => sameBlock(b, base[i]));
};

/** Edited usual blocks -> deletes / updates / inserts. */
export const buildUsualChanges = (originals: RecurringBlock[], rows: Row[], allWeekdays: number[]): BlockChanges => {
  const changes: BlockChanges = { deleteIds: [], updates: [], inserts: [] };
  for (const o of originals) {
    if (!o.id) continue;
    const row = rows.find((r) => r.id === o.id);
    if (!row) {
      changes.deleteIds.push(o.id);
      continue;
    }
    const [next] = rowsToDayBlocks([row]);
    if (!sameBlock(next, o)) changes.updates.push({ ...o, id: o.id, ...next });
  }
  rows
    .filter((r) => !r.id)
    .forEach((r) => changes.inserts.push({ ...rowsToDayBlocks([r])[0], weekdays: r.weekdays ?? allWeekdays }));
  return changes;
};
