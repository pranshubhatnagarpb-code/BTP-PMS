import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Supplement {
  id: string;
  name: string;
  directions: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type SupplementInput = Pick<Supplement, 'name' | 'directions'>;

// The line added to a diet plan for a supplement, e.g. "2B12 * 30 days -- post breakfast".
export const supplementLine = (s: Pick<Supplement, 'name' | 'directions'>) =>
  [s.name.trim(), s.directions.trim()].filter(Boolean).join(' ');

const QUERY_KEY = ['supplements'];

export const useSupplements = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplements')
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data as Supplement[];
    },
  });
};

export const useCreateSupplement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplementInput) => {
      const { data: last } = await supabase
        .from('supplements')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase
        .from('supplements')
        .insert({ ...input, sort_order: (last?.sort_order ?? 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => toast.error('Failed to add supplement', { description: error.message }),
  });
};

export const useUpdateSupplement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<SupplementInput & Pick<Supplement, 'is_active'>> & { id: string }) => {
      const { error } = await supabase.from('supplements').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => toast.error('Failed to update supplement', { description: error.message }),
  });
};

export const useDeleteSupplement = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => toast.error('Failed to delete supplement', { description: error.message }),
  });
};
