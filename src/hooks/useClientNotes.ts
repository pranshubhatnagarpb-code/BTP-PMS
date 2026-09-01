import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TimelineEntry =
  | { type: 'note'; id: string; at: string; text: string }
  | {
      type: 'scheduled';
      id: string;
      at: string;
      appointmentDate: string;
      appointmentTime: string;
      appointmentType: string;
      notes: string | null;
      status: string;
    }
  | {
      type: 'rescheduled';
      id: string;
      at: string;
      previousDate: string;
      previousTime: string;
      newDate: string;
      newTime: string;
    };

// Merges manual notes, appointment-scheduled events, and reschedule events
// into one chronological timeline for a client — nothing is fetched until
// `enabled` is true (the notes dialog opens).
export const useClientTimeline = (clientId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['client-timeline', clientId],
    queryFn: async (): Promise<TimelineEntry[]> => {
      const [notesRes, appointmentsRes, reschedulesRes] = await Promise.all([
        supabase
          .from('client_notes')
          .select('id, note, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, appointment_type, status, notes, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointment_reschedules')
          .select('id, previous_date, previous_time, new_date, new_time, rescheduled_at, appointments!inner(client_id)')
          .eq('appointments.client_id', clientId)
          .order('rescheduled_at', { ascending: false }),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (reschedulesRes.error) throw reschedulesRes.error;

      const entries: TimelineEntry[] = [
        ...(notesRes.data || []).map((n) => ({
          type: 'note' as const,
          id: n.id,
          at: n.created_at,
          text: n.note,
        })),
        ...(appointmentsRes.data || []).map((a) => ({
          type: 'scheduled' as const,
          id: a.id,
          at: a.created_at,
          appointmentDate: a.appointment_date,
          appointmentTime: a.appointment_time,
          appointmentType: a.appointment_type,
          notes: a.notes,
          status: a.status,
        })),
        ...(reschedulesRes.data || []).map((r) => ({
          type: 'rescheduled' as const,
          id: r.id,
          at: r.rescheduled_at,
          previousDate: r.previous_date,
          previousTime: r.previous_time,
          newDate: r.new_date,
          newTime: r.new_time,
        })),
      ];

      return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
    enabled,
  });
};

export const useAddClientNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, note }: { clientId: string; note: string }) => {
      const { error } = await supabase.from('client_notes').insert({ client_id: clientId, note });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-timeline', variables.clientId] });
      toast.success('Note added');
    },
    onError: (error) => {
      toast.error('Failed to add note', { description: error.message });
    },
  });
};
