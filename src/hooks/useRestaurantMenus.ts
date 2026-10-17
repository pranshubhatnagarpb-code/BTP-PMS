import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HealthyMenuOption {
  name: string;
  description: string | null;
  whyHealthy: string;
  estimatedCalories: string | null;
}

export interface RestaurantMenu {
  id: string;
  restaurant_name: string;
  restaurant_name_normalized: string;
  location: string | null;
  healthy_options: HealthyMenuOption[];
  summary_text: string;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantMenuInput {
  restaurant_name: string;
  location?: string | null;
  healthy_options: HealthyMenuOption[];
  summary_text: string;
  employee_id?: string | null;
}

const TABLE_NAME = 'restaurant_menus';
const restaurantMenusTable = () => (supabase as any).from(TABLE_NAME);

// Mirrors the DB trigger's normalization (public.normalize_restaurant_name)
// so the frontend can warn about an existing match before ever hitting the
// server — lowercased, alphanumeric-only.
export const normalizeRestaurantName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const useRestaurantMenus = () => {
  return useQuery({
    queryKey: ['restaurant-menus'],
    queryFn: async () => {
      const { data, error } = await restaurantMenusTable()
        .select('*')
        .order('restaurant_name', { ascending: true });

      if (error) throw error;
      return (data || []) as RestaurantMenu[];
    },
  });
};

// Upsert on the normalized name so re-analyzing a restaurant refreshes its
// cached entry instead of creating a duplicate — the DB trigger fills in
// restaurant_name_normalized before the unique constraint is checked.
export const useSaveRestaurantMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (menu: RestaurantMenuInput) => {
      const { data, error } = await restaurantMenusTable()
        .upsert(menu as any, { onConflict: 'restaurant_name_normalized' })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as RestaurantMenu;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-menus'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to save restaurant menu', { description: error.message });
    },
  });
};

export const useDeleteRestaurantMenu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await restaurantMenusTable().delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-menus'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete restaurant menu', { description: error.message });
    },
  });
};
