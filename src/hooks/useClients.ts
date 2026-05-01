import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  date_of_birth: string | null;
  anniversary_date: string | null;
  weight: number | null;
  height: number | null;
  health_conditions: string[];
  supplements: string | null;
  total_receivables: number | null;
  total_fees: number | null;
  is_active: boolean | null;
  notes: string | null;
  gender: string | null;
  skin_type: string | null;
  hair_type: string | null;
  goal: string | null;
  diet_preference: string | null;
  service_start_date: string | null;
  service_duration_months: number | null;
  number_of_diet_charts: number | null;
  employee_id: string | null;
  service_paused_days: number | null;
  pause_start_date: string | null;
  pause_end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>;

export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Client[];
    },
  });
};

// Enhanced hook with diet plan data
export const useClientsWithDietData = () => {
  return useQuery({
    queryKey: ['clients-with-diet-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          diet_plans (
            id,
            status,
            start_date,
            end_date,
            created_at,
            is_ai_generated,
            ai_plan_data,
            diet_plan_days (
              id
            )
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as unknown as (Client & { diet_plans: DietPlan[] })[];
    },
  });
};

export interface DietPlan {
  id: string;
  client_id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  is_ai_generated?: boolean;
  ai_plan_data?: any;
  diet_plan_days?: { id: string }[];
}

export interface ClientWithDietData extends Client {
  diet_plans: DietPlan[];
}

export const useActiveClients = () => {
  return useQuery({
    queryKey: ['clients', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as Client[];
    },
  });
};

export const useTodaysBirthdays = () => {
  return useQuery({
    queryKey: ['clients', 'birthdays'],
    queryFn: async () => {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, date_of_birth, anniversary_date');
      
      if (error) throw error;
      
      // Filter in JavaScript since date columns can't use ilike
      return (data || []).filter(client => {
        const dobMatch = client.date_of_birth?.endsWith(`-${month}-${day}`);
        const annMatch = client.anniversary_date?.endsWith(`-${month}-${day}`);
        return dobMatch || annMatch;
      });
    },
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (client: ClientInput) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(client as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error('Failed to create client', { description: error.message });
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...client }: Partial<ClientInput> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(client as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error('Failed to update client', { description: error.message });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error('Failed to delete client', { description: error.message });
    },
  });
};
