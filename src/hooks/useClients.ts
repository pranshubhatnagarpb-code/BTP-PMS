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
  employee_id: string | null;
  created_at: string;
  updated_at: string;
}

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
    mutationFn: async (client: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
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
    mutationFn: async ({ id, ...client }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(client)
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
