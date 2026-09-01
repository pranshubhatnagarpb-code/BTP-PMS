import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Appointment {
  id: string;
  client_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  status: string;
  notes: string | null;
  google_event_id: string | null;
  meet_link: string | null;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; phone?: string | null };
}

// Best-effort call to the server — creating the Google Calendar event is a
// side effect of booking an appointment, not something that should ever fail
// the appointment creation itself (e.g. Google not connected yet).
const generateMeetLink = async (appointmentId: string) => {
  try {
    const res = await fetch('/api/google/calendar/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to generate Meet link');
    if (data.meetLink && !data.invited) {
      toast.warning('Meet link created, but no invite was sent', {
        description: 'This client has no email on file — add one to their profile so they get invited next time.',
      });
    }
    return data as { meetLink: string | null; invited: boolean };
  } catch (error) {
    toast.warning('Appointment saved, but the Google Meet link could not be generated', {
      description: error instanceof Error ? error.message : undefined,
    });
    return null;
  }
};

const deleteMeetLink = async (appointmentId: string) => {
  try {
    await fetch('/api/google/calendar/delete-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
  } catch {
    // Non-fatal — the appointment status change should still succeed.
  }
};

// Best-effort — patches the existing calendar event's time in place (keeping
// the same Meet link) after a reschedule. Never blocks the reschedule itself.
const updateMeetLink = async (appointmentId: string) => {
  try {
    const res = await fetch('/api/google/calendar/update-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to update the Google Calendar event');
    if (!data.skipped) {
      toast.success('Google Calendar event updated to the new time');
    }
  } catch (error) {
    toast.warning('Appointment rescheduled, but the Google Calendar event could not be updated', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
};

export interface AppointmentReschedule {
  id: string;
  appointment_id: string;
  previous_date: string;
  previous_time: string;
  new_date: string;
  new_time: string;
  rescheduled_at: string;
}

export const useAllAppointments = () => {
  return useQuery({
    queryKey: ['appointments', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, appointment_time, appointment_type, status, notes,
          google_event_id, meet_link, created_at,
          clients ( id, name, phone )
        `)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointment: {
      client_id: string;
      appointment_date: string;
      appointment_time: string;
      appointment_type: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select()
        .single();

      if (error) throw error;

      // Auto-schedule the Google Meet — best-effort, never blocks appointment creation.
      await generateMeetLink(data.id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create appointment', { description: error.message });
    },
  });
};

// Manual "Generate Link" action for appointments that don't have one yet
// (e.g. created before Google was connected, or the auto-generation failed).
export const useGenerateMeetLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const res = await fetch('/api/google/calendar/create-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to generate Meet link');
      return data as { meetLink: string | null; invited: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (data.invited) {
        toast.success('Meet link generated and client invited');
      } else {
        toast.warning('Meet link generated, but no invite was sent', {
          description: 'This client has no email on file — add one to their profile so they get invited next time.',
        });
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate Meet link', { description: error.message });
    },
  });
};

export const useUpdateAppointmentStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      // Cancelling an appointment removes the Meet invite from Amit's calendar too.
      if (status === 'cancelled') {
        await deleteMeetLink(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status', { description: error.message });
    },
  });
};

export const useRescheduleAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      previousDate,
      previousTime,
      newDate,
      newTime,
    }: {
      id: string;
      previousDate: string;
      previousTime: string;
      newDate: string;
      newTime: string;
    }) => {
      const { error: historyError } = await supabase.from('appointment_reschedules').insert({
        appointment_id: id,
        previous_date: previousDate,
        previous_time: previousTime,
        new_date: newDate,
        new_time: newTime,
      });
      if (historyError) throw historyError;

      const { error: updateError } = await supabase
        .from('appointments')
        .update({ appointment_date: newDate, appointment_time: newTime })
        .eq('id', id);
      if (updateError) throw updateError;

      // Keep the same Meet link/event, just move its time — best-effort.
      await updateMeetLink(id);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-reschedules', variables.id] });
      toast.success('Appointment rescheduled');
    },
    onError: (error) => {
      toast.error('Failed to reschedule appointment', { description: error.message });
    },
  });
};

export const useAppointmentRescheduleHistory = (appointmentId: string, enabled: boolean) => {
  return useQuery({
    queryKey: ['appointment-reschedules', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_reschedules')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('rescheduled_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AppointmentReschedule[];
    },
    enabled,
  });
};
