import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AppointmentOutcome,
  ClinicLocation,
  MeetingMode,
  STATUS_FOR_OUTCOME,
  dietFollowupDueAt,
} from '@/lib/appointmentOutcomes';
import type { AppointmentColor } from '@/lib/appointmentColors';

export interface Appointment {
  id: string;
  client_id: string;
  appointment_date: string;
  appointment_time: string;
  appointment_type: string;
  meeting_mode: MeetingMode;
  clinic_location: ClinicLocation | null;
  duration_minutes: number;
  // Custom title; null shows the appointment type. Also the Zoho event title.
  title: string | null;
  // Calendar colour picked by staff; null colours it automatically.
  color: AppointmentColor | null;
  status: string;
  notes: string | null;
  meet_link: string | null;
  zoho_event_uid: string | null;
  outcome: AppointmentOutcome | null;
  outcome_notes: string | null;
  outcome_recorded_at: string | null;
  diet_followup_due_at: string | null;
  diet_followup_done_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: { id: string; name: string; phone?: string | null; address_as?: string | null };
}

const APPOINTMENT_FIELDS = `
  id, client_id, appointment_date, appointment_time, appointment_type, meeting_mode, clinic_location, duration_minutes, title, color, status, notes,
  meet_link, zoho_event_uid, outcome, outcome_notes, outcome_recorded_at,
  diet_followup_due_at, diet_followup_done_at, created_at, updated_at,
  clients ( id, name, phone, address_as )
`;

const postJson = async (path: string, body: unknown) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

// Toast for a Zoho event created without a meeting link. Calendar-only Zoho
// accounts (no Zoho Meeting subscription) can't get a link from Zoho at all.
const noMeetLinkToast = (data: { meetingsAvailable?: boolean }): [string, { description: string }] =>
  data.meetingsAvailable === false
    ? [
        'Added to Zoho Calendar — no video link',
        { description: 'The connected Zoho account has no Zoho Meeting, so no meeting link was created. Share a video link with the client separately.' },
      ]
    : [
        'Added to Zoho Calendar, but no Zoho Meeting link came back',
        { description: 'Open the event in Zoho Calendar to check the meeting link.' },
      ];

// Best-effort — creating the Zoho event blocks the slot on the calendar for every
// appointment and must never fail the booking itself (e.g. Zoho not connected yet).
// Only online / physical+online events get a Zoho Meeting link.
const createZohoEvent = async (appointmentId: string) => {
  try {
    const data = await postJson('/api/zoho/calendar/create-event', { appointmentId });
    if (data.isOnline && data.success && !data.meetLink) {
      toast.warning(...noMeetLinkToast(data));
    }
  } catch (error) {
    toast.warning('Appointment saved, but it could not be added to Zoho Calendar', {
      description: error instanceof Error ? error.message : undefined,
    });
  }
};

const deleteZohoEvent = async (appointmentId: string) => {
  try {
    await postJson('/api/zoho/calendar/delete-event', { appointmentId });
  } catch {
    // Non-fatal — the appointment change should still succeed.
  }
};

// Best-effort — updates the existing Zoho event (same meeting link) after a
// reschedule or title change.
const updateZohoEvent = async (appointmentId: string, successMessage = 'Zoho Calendar event moved to the new time') => {
  try {
    const data = await postJson('/api/zoho/calendar/update-event', { appointmentId });
    if (!data.skipped) toast.success(successMessage);
  } catch (error) {
    toast.warning('Appointment saved, but the Zoho Calendar event could not be updated', {
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
        .select(APPOINTMENT_FIELDS)
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Appointment[];
    },
  });
};

// Scheduled appointments from today or earlier that nobody has closed yet —
// they stay on the dashboard until an outcome is recorded.
export const useAppointmentsAwaitingOutcome = () => {
  return useQuery({
    queryKey: ['appointments', 'awaiting-outcome'],
    queryFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('appointments')
        .select(APPOINTMENT_FIELDS)
        .eq('status', 'scheduled')
        .lte('appointment_date', today)
        .order('appointment_date')
        .order('appointment_time');

      if (error) throw error;
      return (data || []) as unknown as Appointment[];
    },
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    // Several clients (e.g. a couple coming together) get one appointment each at
    // the same slot, so every client keeps their own history and outcome.
    // zohoEvent: a meeting already booked in Zoho Calendar. The appointment is
    // linked to that event instead of creating a second one.
    mutationFn: async ({ client_ids, zohoEvent, ...appointment }: {
      client_ids: string[];
      zohoEvent?: { uid: string; calendarUid: string; meetLink: string | null };
      appointment_date: string;
      appointment_time: string;
      appointment_type: string;
      meeting_mode: MeetingMode;
      clinic_location: ClinicLocation | null;
      duration_minutes: number;
      title?: string | null;
      color?: AppointmentColor | null;
      notes?: string;
    }) => {
      // One Zoho event can only belong to one appointment (the sync deletes the
      // appointment when its event goes away).
      if (zohoEvent && client_ids.length !== 1) throw new Error('Pick one client for a meeting booked in Zoho');
      const link = zohoEvent
        ? { zoho_event_uid: zohoEvent.uid, zoho_calendar_uid: zohoEvent.calendarUid, meet_link: zohoEvent.meetLink }
        : {};
      const { data, error } = await supabase
        .from('appointments')
        .insert(client_ids.map((client_id) => ({ ...appointment, ...link, client_id })))
        .select();

      if (error) throw error;

      if (!zohoEvent) for (const row of data) await createZohoEvent(row.id);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(data.length > 1 ? `${data.length} appointments created` : 'Appointment created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create appointment', { description: error.message });
    },
  });
};

// Manual "Generate Link" for online appointments without one yet
// (e.g. created before Zoho was connected, or the automatic step failed).
export const useGenerateMeetLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) =>
      postJson('/api/zoho/calendar/create-event', { appointmentId }) as Promise<{ meetLink: string | null; meetingsAvailable?: boolean }>,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (!data.meetLink) {
        toast.warning(...noMeetLinkToast(data));
      } else {
        toast.success('Zoho Meeting link generated');
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate meeting link', { description: error.message });
    },
  });
};

// Closes an appointment with what happened. A held online / physical+online
// meeting schedules the diet plan follow-up 48h later.
export const useRecordAppointmentOutcome = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointment, outcome, notes }: {
      appointment: Pick<Appointment, 'id' | 'meeting_mode'>;
      outcome: AppointmentOutcome;
      notes?: string;
    }) => {
      const recordedAt = new Date();
      const dueAt = dietFollowupDueAt(appointment.meeting_mode, outcome, recordedAt);
      const { error } = await supabase
        .from('appointments')
        .update({
          status: STATUS_FOR_OUTCOME[outcome],
          outcome,
          outcome_notes: notes?.trim() || null,
          outcome_recorded_at: recordedAt.toISOString(),
          diet_followup_due_at: dueAt?.toISOString() ?? null,
          diet_followup_done_at: null,
        })
        .eq('id', appointment.id);
      if (error) throw error;

      if (outcome === 'cancelled') await deleteZohoEvent(appointment.id);
      return { dueAt };
    },
    onSuccess: ({ dueAt }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment outcome recorded', {
        description: dueAt ? `Diet plan reminder set for ${dueAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.` : undefined,
      });
    },
    onError: (error) => {
      toast.error('Failed to record outcome', { description: error.message });
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

      await updateZohoEvent(id);
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

// Edits an appointment's details. Date / time changes go through
// useRescheduleAppointment instead, so they're kept in the reschedule history.
export const useUpdateAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: {
      id: string;
      title: string | null;
      appointment_type: string;
      duration_minutes: number;
      meeting_mode: MeetingMode;
      clinic_location: ClinicLocation | null;
      color: AppointmentColor | null;
      notes: string | null;
    }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(patch)
        .eq('id', id)
        .select('zoho_event_uid')
        .single();
      if (error) throw error;
      if (data.zoho_event_uid) await updateZohoEvent(id, 'Zoho Calendar event updated');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment updated');
    },
    onError: (error) => {
      toast.error('Failed to update appointment', { description: error.message });
    },
  });
};

// Removes the appointment entirely (unlike Cancel, which keeps it with an
// outcome), along with its Zoho Calendar event.
export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteZohoEvent(id);
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast.success('Appointment deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete appointment', { description: error.message });
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

// ---------------------------------------------------------------------------
// Diet plan follow-ups after held meetings
// ---------------------------------------------------------------------------

export interface DietFollowup extends Appointment {
  clients: { id: string; name: string; phone?: string | null };
}

// Follow-ups that are due and not done. A follow-up clears itself once the
// client has an approved diet plan created after the meeting was closed.
export const useDueDietFollowups = () => {
  return useQuery({
    queryKey: ['appointments', 'diet-followups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(APPOINTMENT_FIELDS)
        .not('diet_followup_due_at', 'is', null)
        .is('diet_followup_done_at', null)
        .lte('diet_followup_due_at', new Date().toISOString())
        .order('diet_followup_due_at');
      if (error) throw error;

      const followups = (data || []) as unknown as DietFollowup[];
      if (followups.length === 0) return [];

      const { data: plans, error: plansError } = await supabase
        .from('diet_plans')
        .select('client_id, created_at')
        .eq('status', 'approved')
        .in('client_id', [...new Set(followups.map((f) => f.client_id))]);
      if (plansError) throw plansError;

      return followups.filter((f) => !(plans || []).some(
        (p) => p.client_id === f.client_id && p.created_at > (f.outcome_recorded_at ?? ''),
      ));
    },
  });
};

export const useUpdateDietFollowup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; diet_followup_due_at?: string; diet_followup_done_at?: string | null }) => {
      const { error } = await supabase.from('appointments').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (error) => {
      toast.error('Failed to update diet plan reminder', { description: error.message });
    },
  });
};
