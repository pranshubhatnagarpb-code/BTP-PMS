import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BodyMeasurement {
  id: string;
  client_id: string;
  measurement_date: string;
  weight: number | null;
  bmi: number | null;
  body_fat_percent: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  thigh: number | null;
  arm: number | null;
  neck: number | null;
  calf: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurementWithClientName extends BodyMeasurement {
  client_name: string;
}

export interface BodyMeasurementInput {
  client_id: string;
  measurement_date: string;
  weight?: number | null;
  bmi?: number | null;
  body_fat_percent?: number | null;
  waist?: number | null;
  hip?: number | null;
  chest?: number | null;
  thigh?: number | null;
  arm?: number | null;
  neck?: number | null;
  calf?: number | null;
  notes?: string | null;
}

const TABLE_NAME = 'body_measurements';
const bodyMeasurementsTable = () => (supabase as any).from(TABLE_NAME);

export const hasAnyMeasurementValue = (measurement: Partial<BodyMeasurementInput>) => {
  const numericFields: Array<keyof Omit<BodyMeasurementInput, 'client_id' | 'measurement_date' | 'notes'>> = [
    'weight',
    'bmi',
    'body_fat_percent',
    'waist',
    'hip',
    'chest',
    'thigh',
    'arm',
    'neck',
    'calf',
  ];

  return numericFields.some((field) => measurement[field] !== null && measurement[field] !== undefined)
    || Boolean(measurement.notes?.trim());
};

export const useBodyMeasurements = (clientId?: string) => {
  return useQuery({
    queryKey: ['body-measurements', clientId ?? 'all'],
    queryFn: async () => {
      let query = bodyMeasurementsTable()
        .select('*, clients(name)')
        .order('measurement_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((item: any) => ({
        ...item,
        client_name: item.clients?.name || 'Unknown',
      })) as BodyMeasurementWithClientName[];
    },
    enabled: true,
  });
};

export const useCreateBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (measurement: BodyMeasurementInput) => {
      const { data, error } = await bodyMeasurementsTable()
        .insert(measurement as any)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BodyMeasurement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to save measurement', { description: error.message });
    },
  });
};

export const useUpdateBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...measurement }: Partial<BodyMeasurementInput> & { id: string; client_id: string }) => {
      const { data, error } = await bodyMeasurementsTable()
        .update(measurement as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BodyMeasurement;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', variables.client_id] });
    },
    onError: (error) => {
      toast.error('Failed to update measurement', { description: error.message });
    },
  });
};

export const useDeleteBodyMeasurement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await bodyMeasurementsTable()
        .delete()
        .eq('id', id);

      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['body-measurements'] });
      queryClient.invalidateQueries({ queryKey: ['body-measurements', clientId] });
    },
    onError: (error) => {
      toast.error('Failed to delete measurement', { description: error.message });
    },
  });
};