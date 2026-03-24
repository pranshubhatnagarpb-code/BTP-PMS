import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DayPlanInput {
  day_label: string;
  breakfast_option_id: string | null;
  lunch_option_id: string | null;
  snacks_option_id: string | null;
  dinner_option_id: string | null;
  total_calories: number;
  notes: string;
  sort_order: number;
}

interface CreateDietPlanInput {
  client_id: string;
  plan_name: string;
  instructions: string;
  days: DayPlanInput[];
}

export const useCreateDietPlan = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateDietPlanInput) => {
      const { data: plan, error: planError } = await supabase
        .from('diet_plans')
        .insert({
          client_id: input.client_id,
          plan_name: input.plan_name,
          instructions: input.instructions,
          status: 'active',
        })
        .select()
        .single();
      
      if (planError) throw planError;

      const dayEntries = input.days.map((day, index) => ({
        diet_plan_id: plan.id,
        day_label: day.day_label,
        breakfast_option_id: day.breakfast_option_id || null,
        lunch_option_id: day.lunch_option_id || null,
        snacks_option_id: day.snacks_option_id || null,
        dinner_option_id: day.dinner_option_id || null,
        total_calories: day.total_calories,
        notes: day.notes,
        sort_order: index,
      }));

      const { error: daysError } = await supabase
        .from('diet_plan_days')
        .insert(dayEntries);
      
      if (daysError) throw daysError;

      return plan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      toast.success('Diet plan created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create diet plan', { description: error.message });
    },
  });
};

export const useSavedDietPlans = () => {
  return useQuery({
    queryKey: ['diet_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select(`
          *,
          clients (id, name, email, phone),
          diet_plan_days (
            *,
            breakfast_option:diet_options!diet_plan_days_breakfast_option_id_fkey (id, name, calories),
            lunch_option:diet_options!diet_plan_days_lunch_option_id_fkey (id, name, calories),
            snacks_option:diet_options!diet_plan_days_snacks_option_id_fkey (id, name, calories),
            dinner_option:diet_options!diet_plan_days_dinner_option_id_fkey (id, name, calories)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useDeleteDietPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      // Delete days first
      const { error: daysError } = await supabase
        .from('diet_plan_days')
        .delete()
        .eq('diet_plan_id', planId);
      if (daysError) throw daysError;

      const { error } = await supabase
        .from('diet_plans')
        .delete()
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet_plans'] });
      toast.success('Diet plan deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete plan', { description: error.message });
    },
  });
};
