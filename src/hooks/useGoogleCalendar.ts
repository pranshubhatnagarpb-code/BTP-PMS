import { useQuery } from '@tanstack/react-query';

export interface GoogleCalendarStatus {
  connected: boolean;
  email: string | null;
}

export const useGoogleCalendarStatus = () => {
  return useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: async (): Promise<GoogleCalendarStatus> => {
      const res = await fetch('/api/google/status');
      if (!res.ok) return { connected: false, email: null };
      return res.json();
    },
  });
};

// A plain navigation (not a fetch) — the server redirects the browser
// straight to Google's consent screen.
export const connectGoogleCalendar = () => {
  window.location.href = '/api/google/connect';
};

export const disconnectGoogleCalendar = async () => {
  const res = await fetch('/api/google/disconnect', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect');
};
