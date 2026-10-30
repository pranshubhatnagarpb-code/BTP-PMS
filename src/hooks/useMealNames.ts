import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/mealRecipes';
// Used until the meal_names migration has been run.
import bundledMealNames from '@/data/mealNames.json';

// Not in the generated Supabase types until they're regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mealNamesTable = () => (supabase as any).from('meal_names');

/** The master meal list shown in the manual planner's meal picker. */
export const useMealNames = () => {
  const query = useQuery({
    queryKey: ['meal_names'],
    queryFn: async () => (await fetchAllRows<{ name: string }>('meal_names', 'id, name', 'name')).map((r) => r.name),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    ...query,
    names: query.data ?? (query.isError ? (bundledMealNames as string[]) : []),
    tableMissing: query.isError,
  };
};

/** Adds meals typed in the planner to the master list (names already in it are skipped). */
export const useAddMealNames = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (names: string[]) => {
      if (!names.length) return 0;
      const { data, error } = await mealNamesTable()
        .upsert(
          names.map((name) => ({ name, source: 'planner' })),
          { onConflict: 'name_normalized', ignoreDuplicates: true },
        )
        .select('id');
      if (error) throw error;
      return (data ?? []).length;
    },
    onSuccess: (added) => {
      if (!added) return;
      queryClient.invalidateQueries({ queryKey: ['meal_names'] });
      toast.success(`${added} new meal${added > 1 ? 's' : ''} added to the meal list`);
    },
    onError: (error: Error) => {
      // The plan itself is already saved; only the list update failed.
      toast.warning('Plan saved, but new meals could not be added to the meal list', { description: error.message });
    },
  });
};
