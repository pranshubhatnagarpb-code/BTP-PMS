// Edit the daily blocks (lunch, breaks...) on the appointments calendar.
// - Usual blocks: shown on every day, with no end date.
// - One date: changes apply to that date only; "Reset to usual blocks" undoes them.
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  blocksForDate,
  useBlockOverrides,
  useRecurringBlocks,
  useResetDayBlocks,
  useSaveDayBlocks,
  useSaveRecurringBlocks,
} from '@/hooks/useRecurringBlocks';
import { ALL_WEEKDAYS, WEEKDAY_ORDER, WEEKDAY_SHORT, blocksOnWeekday } from '@/lib/appointmentOutcomes';
import {
  blocksToRows,
  buildUsualChanges,
  matchesUsual,
  newKey,
  rowProblem,
  rowsToDayBlocks,
  type Row,
} from '@/lib/recurringBlockEdits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Mode = 'date' | 'usual';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens on this date's blocks; omitted opens the usual blocks. */
  date?: Date | null;
}

export const RecurringBlocksDialog = ({ open, onOpenChange, date }: Props) => {
  const { blocks: usual, tableMissing } = useRecurringBlocks();
  const { overrides, tableMissing: overridesMissing } = useBlockOverrides(date ?? null, date ?? null);
  const saveUsual = useSaveRecurringBlocks();
  const saveDay = useSaveDayBlocks();
  const resetDay = useResetDayBlocks();
  const [mode, setMode] = useState<Mode>('usual');
  const [rows, setRows] = useState<Row[]>([]);

  const dayHasOwnBlocks = Boolean(date && overrides.has(format(date, 'yyyy-MM-dd')));

  const rowsFor = (m: Mode) => (m === 'date' && date ? blocksToRows(blocksForDate(date, usual, overrides)) : blocksToRows(usual));

  useEffect(() => {
    if (!open) return;
    const initial: Mode = date ? 'date' : 'usual';
    setMode(initial);
    setRows(rowsFor(initial));
    // Rows are built when the dialog opens (or the date's data arrives), so a
    // background refetch of the usual blocks doesn't wipe edits in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, overrides]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setRows(rowsFor(m));
  };

  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((list) => [...list, { key: newKey(), label: '', start: '13:00', end: '14:00' }]);
  const removeRow = (key: string) => setRows((list) => list.filter((r) => r.key !== key));

  const hasProblems = rows.some((r) => rowProblem(r));
  const pending = saveUsual.isPending || saveDay.isPending || resetDay.isPending;
  const close = () => onOpenChange(false);

  const handleSave = () => {
    if (hasProblems) return;
    if (mode === 'usual') {
      const changes = buildUsualChanges(usual, rows, ALL_WEEKDAYS);
      if (!changes.deleteIds.length && !changes.updates.length && !changes.inserts.length) return close();
      saveUsual.mutate(changes, { onSuccess: close });
      return;
    }
    if (!date) return;
    // Back to exactly the usual blocks: drop the one-off change instead of copying them.
    if (matchesUsual(rows, blocksOnWeekday(usual, date.getDay()))) {
      if (dayHasOwnBlocks) resetDay.mutate(date, { onSuccess: close });
      else close();
      return;
    }
    saveDay.mutate({ date, blocks: rowsToDayBlocks(rows) }, { onSuccess: close });
  };

  const missing = tableMissing || (mode === 'date' && overridesMissing);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'date' && date ? `Blocks on ${format(date, 'EEEE, d MMM yyyy')}` : 'Usual daily blocks'}
          </DialogTitle>
        </DialogHeader>

        {date && (
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={mode === 'date' ? 'default' : 'outline'} className="h-8" onClick={() => switchMode('date')}>
              Only {format(date, 'EEE, d MMM')}
            </Button>
            <Button size="sm" variant={mode === 'usual' ? 'default' : 'outline'} className="h-8" onClick={() => switchMode('usual')}>
              Usual blocks (every day)
            </Button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {mode === 'date'
            ? dayHasOwnBlocks
              ? 'This date has its own blocks. Changes apply to this date only.'
              : 'Changes apply to this date only — every other day keeps the usual blocks.'
            : 'Shown on every day unless a date has its own blocks. Times are IST.'}
        </p>

        {missing ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Run the daily blocks database migrations to edit these. Until then the calendar shows the original blocks on every day.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">{mode === 'date' ? 'No blocks on this date.' : 'No usual blocks.'}</p>
            )}
            {rows.map((r) => {
              const problem = rowProblem(r);
              const someDays = mode === 'usual' && r.weekdays && r.weekdays.length < 7;
              return (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.label}
                      onChange={(e) => update(r.key, { label: e.target.value })}
                      placeholder="e.g. Lunch"
                      maxLength={80}
                      className="min-w-0 flex-1"
                      aria-label="Block name"
                    />
                    <Input
                      type="time"
                      value={r.start}
                      onChange={(e) => update(r.key, { start: e.target.value })}
                      className="w-[7.5rem]"
                      aria-label="Start time"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={r.end}
                      onChange={(e) => update(r.key, { end: e.target.value })}
                      className="w-[7.5rem]"
                      aria-label="End time"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => removeRow(r.key)}
                      aria-label="Remove block"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {someDays && (
                    <p className="text-xs text-muted-foreground">
                      Only on {WEEKDAY_ORDER.filter((d) => r.weekdays!.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ')}
                    </p>
                  )}
                  {problem && <p className="text-xs text-destructive">{problem}</p>}
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" /> Add block
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {mode === 'date' && date && dayHasOwnBlocks ? (
            <Button variant="ghost" onClick={() => resetDay.mutate(date, { onSuccess: close })} disabled={pending}>
              <RotateCcw className="h-4 w-4 mr-1" /> Reset to usual blocks
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={missing || hasProblems || pending}>
              {pending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
