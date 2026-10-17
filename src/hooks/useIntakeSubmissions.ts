import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IntakeSubmission {
  id: string;
  created_at: string;
  branch: 'female' | 'male' | 'child';
  age: number | null;
  dob: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  payload: Record<string, unknown>;
  pms_lead_id: string | null;
  pms_status: 'pending' | 'sent' | 'failed' | 'duplicate_merged';
  pms_error: string | null;
}

// Public wellness-intake-hub-main writes here directly (service-role key,
// bypasses RLS) and stamps pms_lead_id with the matching clients.id once
// synced — that's what links a submission back to a client row here.
export const useClientIntakeSubmissions = (clientId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['intake-submissions', clientId],
    queryFn: async (): Promise<IntakeSubmission[]> => {
      const { data, error } = await supabase
        .from('intake_submissions')
        .select('*')
        .eq('pms_lead_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as IntakeSubmission[];
    },
    enabled,
  });
};
