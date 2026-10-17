import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BloodMarkerKey } from '@/lib/bloodMarkers';
import { buildAnalysisRequest, type BloodReportAnalysis } from '@/lib/bloodReportAnalysis';
import type { Client } from '@/hooks/useClients';

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
  ai_analysis: BloodReportAnalysis | null;
  ai_analysis_generated_at: string | null;
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

export const useBloodReports = (clientId?: string, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: ['blood-reports', clientId ?? 'all'],
    enabled,
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
        // Values may have changed, so any saved AI analysis no longer applies.
        .update({ ...reportFields, client_id, ai_analysis: null, ai_analysis_generated_at: null } as any)
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

// Runs the AI analysis for a report and saves it on the report row.
export const useAnalyzeBloodReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ report, previous, client }: {
      report: BloodReport;
      previous: BloodReport | null;
      client: Client | null;
    }) => {
      const { data, error } = await supabase.functions.invoke('analyze-blood-report', {
        body: buildAnalysisRequest(report, previous, client),
      });
      if (error) throw new Error(error.message || 'Analysis failed');
      if (data?.error) throw new Error(data.error);
      if (!data?.analysis) throw new Error('No analysis returned');

      const analysis = data.analysis as BloodReportAnalysis;
      const generatedAt = new Date().toISOString();
      const { error: saveErr } = await reportsTable()
        .update({ ai_analysis: analysis, ai_analysis_generated_at: generatedAt })
        .eq('id', report.id);
      if (saveErr) throw saveErr;

      return { ...report, ai_analysis: analysis, ai_analysis_generated_at: generatedAt };
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['blood-reports'] });
      queryClient.invalidateQueries({ queryKey: ['blood-reports', report.client_id] });
    },
    onError: (error: any) => {
      toast.error('Failed to analyse blood report', { description: error.message });
    },
  });
};
