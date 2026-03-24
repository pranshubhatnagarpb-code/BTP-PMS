import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Bill {
  id: string;
  client_id: string;
  amount: number;
  due_date: string;
  service_name: string;
  status: string;
  paid_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillWithClientName extends Bill {
  client_name: string;
}

export const useBills = () => {
  return useQuery({
    queryKey: ['bills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receivables')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data.map((item: any) => ({
        ...item,
        client_name: item.clients?.name || 'Unknown',
        date: item.due_date,
      })) as BillWithClientName[];
    },
  });
};

export const useCreateBill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bill: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('receivables')
        .insert({
          client_id: bill.client_id,
          amount: bill.amount,
          due_date: bill.due_date,
          service_name: bill.service_name,
          status: bill.status,
          paid_amount: bill.paid_amount,
          notes: bill.notes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (error) => {
      toast.error('Failed to create bill', { description: error.message });
    },
  });
};

export const useUpdateBill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...bill }: Partial<Bill> & { id: string }) => {
      const { data, error } = await supabase
        .from('receivables')
        .update(bill)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (error) => {
      toast.error('Failed to update bill', { description: error.message });
    },
  });
};

export const useDeleteBill = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('receivables')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
    onError: (error) => {
      toast.error('Failed to delete bill', { description: error.message });
    },
  });
};
