import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ZohoCalendarStatus {
  connected: boolean;
  email: string | null;
}

export const useZohoCalendarStatus = () => {
  return useQuery({
    queryKey: ['zoho-calendar-status'],
    queryFn: async (): Promise<ZohoCalendarStatus> => {
      const res = await fetch('/api/zoho/status');
      if (!res.ok) return { connected: false, email: null };
      return res.json();
    },
  });
};

// A plain navigation (not a fetch) — the server redirects the browser
// straight to Zoho's consent screen.
export const connectZohoCalendar = () => {
  window.location.href = '/api/zoho/connect';
};

export const disconnectZohoCalendar = async () => {
  const res = await fetch('/api/zoho/disconnect', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect');
};

export interface ZohoSyncResult {
  skipped?: boolean;
  checked?: number;
  deleted: number;
  moved: number;
  renamed: number;
}

// Pulls cancellations / time changes made directly in Zoho Calendar into the
// PMS. Runs when a page using it opens and when the tab regains focus, at most
// every 2 minutes; refetch() is the manual "Sync now".
export const useZohoSync = () => {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['zoho-sync'],
    queryFn: async (): Promise<ZohoSyncResult> => {
      const res = await fetch('/api/zoho/calendar/sync', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Sync failed (${res.status})`);
      return data;
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
    // A failed sync (e.g. Zoho rate limit) waits for the next page open or "Sync now".
    refetchOnWindowFocus: (query) => query.state.status !== 'error',
  });

  const { data, dataUpdatedAt } = query;
  useEffect(() => {
    if (!data || (!data.deleted && !data.moved && !data.renamed)) return;
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
    queryClient.invalidateQueries({ queryKey: ['appointment-reschedules'] });
    const parts = [
      data.moved ? `${data.moved} rescheduled` : '',
      data.deleted ? `${data.deleted} deleted` : '',
      data.renamed ? `${data.renamed} renamed` : '',
    ].filter(Boolean);
    toast.info(`Updated from Zoho Calendar: ${parts.join(', ')}`);
    // dataUpdatedAt: toast once per sync, not on every re-render.
  }, [data, dataUpdatedAt, queryClient]);

  return query;
};

// A meeting booked directly in Zoho Calendar (not linked to an appointment).
export interface ZohoExternalEvent {
  uid: string;
  calendarUid: string;
  title: string;
  /** yyyy-mm-dd (IST) */
  date: string;
  endDate: string;
  /** HH:mm:ss (IST); null for all-day events */
  time: string | null;
  duration: number | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  meetLink: string | null;
  /** Part of a repeating series — can't be linked to one appointment. */
  recurring: boolean;
}

// Zoho events in [start, end] (yyyy-mm-dd, at most 31 days) that aren't PMS
// appointments yet. Refreshes with the appointments, so a just-linked event drops out.
export const useZohoEvents = (start: string, end: string, enabled = true) =>
  useQuery({
    queryKey: ['appointments', 'zoho-events', start, end],
    queryFn: async (): Promise<ZohoExternalEvent[]> => {
      const res = await fetch('/api/zoho/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Could not load Zoho events (${res.status})`);
      return data.events || [];
    },
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
