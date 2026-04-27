import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BloodMarkerKey } from '@/lib/bloodMarkers';

export type BloodReportValues = Partial<Record<BloodMarkerKey, number | null>> & {
  notes?: string | null;
};

export interface BloodReport {
  id: string;
  client_id: string;
  report_date: string;
  lab_name: string | null;
  source_file_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  values?: BloodReportValues | null;
}

export interface BloodReportWithClient extends BloodReport {
  client_name: string;
}

export interface BloodReportInput {
  client_id: string;
  report_date: string;
  lab_name?: string | null;
  source_file_name?: string | null;
  notes?: string | null;
  values: BloodReportValues;
}

const REPORTS_TABLE = 'blood_reports';
const VALUES_TABLE = 'blood_report_values';
const reportsTable = () => (supabase as any).from(REPORTS_TABLE);
const valuesTable = () => (supabase as any).from(VALUES_TABLE);

export const useBloodReports = (clientId?: string) => {
  return useQuery({
    queryKey: ['blood-reports', clientId ?? 'all'],
    queryFn: async () => {
      let query = reportsTable()
        .select('*, clients(name), blood_report_values(*)')
        .order('report_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (clientId) query = query.eq('client_id', clientId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        client_name: row.clients?.name || 'Unknown',
        values: Array.isArray(row.blood_report_values) ? row.blood_report_values[0] || null : row.blood_report_values || null,
      })) as BloodReportWithClient[];
    },
  });
};

export const useCreateBloodReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BloodReportInput) => {
      const { values, ...reportFields } = input;
      const { data: report, error: reportErr } = await reportsTable()
        .insert(reportFields as any)
        .select()
        .single();
      if (reportErr) throw reportErr;

      const { error: valuesErr } = await valuesTable().insert({
        report_id: report.id,
        ...values,
      } as any);
      if (valuesErr) throw valuesErr;

      return report as BloodReport;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blood-reports'] });
      queryClient.invalidateQueries({ queryKey: ['blood-reports', variables.client_id] });
    },
    onError: (error: any) => {
      toast.error('Failed to save blood report', { description: error.message });
    },
  });
};

export const useUpdateBloodReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, client_id, values, ...reportFields }: BloodReportInput & { id: string }) => {
      const { error: reportErr } = await reportsTable()
        .update({ ...reportFields, client_id } as any)
        .eq('id', id);
      if (reportErr) throw reportErr;

      // upsert values row by report_id
      const { data: existing } = await valuesTable().select('id').eq('report_id', id).maybeSingle();
      if (existing?.id) {
        const { error: valErr } = await valuesTable().update(values as any).eq('id', existing.id);
        if (valErr) throw valErr;
      } else {
        const { error: valErr } = await valuesTable().insert({ report_id: id, ...values } as any);
        if (valErr) throw valErr;
      }

      return id;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['blood-reports'] });
      queryClient.invalidateQueries({ queryKey: ['blood-reports', variables.client_id] });
    },
    onError: (error: any) => {
      toast.error('Failed to update blood report', { description: error.message });
    },
  });
};

export const useDeleteBloodReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await reportsTable().delete().eq('id', id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['blood-reports'] });
      queryClient.invalidateQueries({ queryKey: ['blood-reports', clientId] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete blood report', { description: error.message });
    },
  });
};
