import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeGuidelineHtml } from '@/lib/dietGuidelines';

export interface DietGuideline {
  id: string;
  title: string;
  content_html: string;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

// Not in the generated Supabase types until they're regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from('diet_guidelines');
const QUERY_KEY = ['diet_guidelines'];

export const useDietGuidelines = () => {
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DietGuideline[]> => {
      const { data, error } = await table().select('*').order('title');
      if (error) throw error;
      return data as DietGuideline[];
    },
    retry: false,
  });
  return { ...query, guidelines: query.data ?? [], tableMissing: query.isError };
};

export const useImportDietGuidelines = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: { title: string; content_html: string; file_name: string }[]) => {
      const { error } = await table().insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success(`${count} guideline${count === 1 ? '' : 's'} imported`);
    },
    onError: (e: Error) => toast.error('Could not import guidelines', { description: e.message }),
  });
};

export const useRenameDietGuideline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { error } = await table().update({ title: title.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Guideline renamed');
    },
    onError: (e: Error) => toast.error('Could not rename guideline', { description: e.message }),
  });
};

export const useDeleteDietGuideline = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Guideline deleted');
    },
    onError: (e: Error) => toast.error('Could not delete guideline', { description: e.message }),
  });
};

/** A plan's own copy of a guideline, edited for that client only. */
export interface GuidelineEdit {
  title: string;
  html: string;
}
export type GuidelineEdits = Record<string, GuidelineEdit>;

/**
 * Selected guidelines, in the order chosen, ready for the PDF (sanitised again on the way in).
 * A plan's edited copy wins over the library version, and survives the library one being deleted.
 */
export const pickGuidelines = (
  all: DietGuideline[],
  ids: string[] | null | undefined,
  edits?: GuidelineEdits | null,
) =>
  (ids || [])
    .map((id) => {
      const edit = edits?.[id];
      if (edit) return edit;
      const g = all.find((x) => x.id === id);
      return g ? { title: g.title, html: g.content_html } : null;
    })
    .filter((g): g is GuidelineEdit => Boolean(g))
    .map((g) => ({ title: g.title, html: sanitizeGuidelineHtml(g.html) }));
