import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DietOption {
  id: string;
  meal_type: string;
  name: string;
  calories: number;
  category: string;
  is_vegetarian: boolean;
  description: string | null;
  created_at: string;
}

export const useDietOptions = () => {
  return useQuery({
    queryKey: ['diet_options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_options')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as DietOption[];
    },
  });
};

export const useDietOptionsByMealType = (mealType: string) => {
  return useQuery({
    queryKey: ['diet_options', mealType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_options')
        .select('*')
        .eq('meal_type', mealType)
        .order('name');
      
      if (error) throw error;
      return data as DietOption[];
    },
  });
};
