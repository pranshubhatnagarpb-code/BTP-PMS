import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ALL_WEEKDAYS, DEFAULT_RECURRING_BLOCKS, blocksOnWeekday, type RecurringBlock } from '@/lib/appointmentOutcomes';

// Not in the generated Supabase types until they're regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: 'recurring_blocks' | 'block_day_overrides') => (supabase as any).from(name);

interface BlockRow { id: string; label: string; start_minute: number; end_minute: number; weekdays?: number[] | null }

const isEveryDay = (days: number[]) => ALL_WEEKDAYS.every((d) => days.includes(d));

// weekdays is only sent for blocks limited to some days, so saving works
// whether or not the (optional) weekdays migration has been run.
const toRow = (b: RecurringBlock) => ({
  label: b.label.trim(),
  start_minute: b.start,
  end_minute: b.end,
  ...(isEveryDay(b.weekdays) ? {} : { weekdays: [...new Set(b.weekdays)].sort() }),
});

// ---------------------------------------------------------------------------
// Usual blocks: shown on every day unless that date has its own blocks.
// ---------------------------------------------------------------------------

// Earliest first. Falls back to the original fixed blocks if the migration
// hasn't been run yet, so the calendar keeps showing them.
export const useRecurringBlocks = () => {
  const query = useQuery({
    queryKey: ['recurring-blocks'],
    queryFn: async (): Promise<RecurringBlock[]> => {
      const { data, error } = await table('recurring_blocks').select('*').order('start_minute');
      if (error) throw error;
      return (data as BlockRow[]).map((r) => ({
        id: r.id,
        label: r.label,
        start: r.start_minute,
        end: r.end_minute,
        weekdays: r.weekdays?.length ? r.weekdays : ALL_WEEKDAYS,
      }));
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { ...query, blocks: query.data ?? (query.isError ? DEFAULT_RECURRING_BLOCKS : []), tableMissing: query.isError };
};

export interface BlockChanges {
  deleteIds: string[];
  updates: (RecurringBlock & { id: string })[];
  inserts: RecurringBlock[];
}

export const useSaveRecurringBlocks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deleteIds, updates, inserts }: BlockChanges) => {
      if (deleteIds.length) {
        const { error } = await table('recurring_blocks').delete().in('id', deleteIds);
        if (error) throw error;
      }
      for (const b of updates) {
        const { error } = await table('recurring_blocks').update(toRow(b)).eq('id', b.id);
        if (error) throw error;
      }
      if (inserts.length) {
        const { error } = await table('recurring_blocks').insert(inserts.map(toRow));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-blocks'] });
      toast.success('Usual daily blocks updated');
    },
    onError: (error: Error) => {
      toast.error('Could not save daily blocks', { description: error.message });
    },
  });
};

// ---------------------------------------------------------------------------
// One-off changes for a single date.
// ---------------------------------------------------------------------------

export interface DayBlock { label: string; start: number; end: number }

const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');

// One shared empty map, so components depending on `overrides` don't re-run every render.
const NO_OVERRIDES = new Map<string, DayBlock[]>();

/** Dates in [start, end] with their own blocks: yyyy-mm-dd -> that day's blocks. */
export const useBlockOverrides = (start: Date | null, end: Date | null) => {
  const from = start ? isoDate(start) : '';
  const to = end ? isoDate(end) : '';
  const query = useQuery({
    queryKey: ['block-overrides', from, to],
    queryFn: async (): Promise<Map<string, DayBlock[]>> => {
      const { data, error } = await table('block_day_overrides').select('block_date, blocks').gte('block_date', from).lte('block_date', to);
      if (error) throw error;
      return new Map((data as { block_date: string; blocks: DayBlock[] }[]).map((r) => [r.block_date, r.blocks || []]));
    },
    enabled: Boolean(from && to),
    staleTime: 60 * 1000,
    retry: false,
  });
  return { ...query, overrides: query.data ?? NO_OVERRIDES, tableMissing: query.isError };
};

/** The blocks on a given date: its own blocks if it has any, otherwise the usual ones. */
export const blocksForDate = (date: Date, usual: RecurringBlock[], overrides: Map<string, DayBlock[]>): DayBlock[] =>
  overrides.get(isoDate(date)) ?? blocksOnWeekday(usual, date.getDay());

export const useSaveDayBlocks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, blocks }: { date: Date; blocks: DayBlock[] }) => {
      const { error } = await table('block_day_overrides').upsert(
        { block_date: isoDate(date), blocks: blocks.map((b) => ({ label: b.label.trim(), start: b.start, end: b.end })) },
        { onConflict: 'block_date' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['block-overrides'] });
      toast.success(`Blocks updated for ${format(date, 'EEE, d MMM')} only`);
    },
    onError: (error: Error) => toast.error('Could not save blocks for this day', { description: error.message }),
  });
};

/** Puts the usual blocks back on a date. */
export const useResetDayBlocks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: Date) => {
      const { error } = await table('block_day_overrides').delete().eq('block_date', isoDate(date));
      if (error) throw error;
    },
    onSuccess: (_d, date) => {
      queryClient.invalidateQueries({ queryKey: ['block-overrides'] });
      toast.success(`${format(date, 'EEE, d MMM')} is back to the usual blocks`);
    },
    onError: (error: Error) => toast.error('Could not reset this day', { description: error.message }),
  });
};
