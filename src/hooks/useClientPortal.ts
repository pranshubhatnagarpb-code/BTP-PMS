import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const portalUsersTable = () => (supabase as any).from('client_portal_users');

// Server-side endpoints (server.js) — creating/deleting a client's login
// requires the Supabase service-role key, which must never run in the browser.
const api = async (path: string, body: Record<string, unknown>) => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// Set of client_ids that currently have portal access enabled.
export const usePortalStatus = () => {
  return useQuery({
    queryKey: ['client-portal-users'],
    queryFn: async () => {
      const { data, error } = await portalUsersTable().select('client_id');
      if (error) throw error;
      return new Set((data || []).map((row: { client_id: string }) => row.client_id));
    },
  });
};

export const useEnablePortal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, email, password }: { clientId: string; email: string; password: string }) =>
      api('/api/portal/enable', { clientId, email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portal-users'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients-with-diet-data'] });
      toast.success('Portal access enabled');
    },
    onError: (error: Error) => {
      toast.error('Failed to enable portal access', { description: error.message });
    },
  });
};

export const useDisablePortal = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => api('/api/portal/disable', { clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-portal-users'] });
      toast.success('Portal access disabled');
    },
    onError: (error: Error) => {
      toast.error('Failed to disable portal access', { description: error.message });
    },
  });
};

export const useResetPortalPassword = () => {
  return useMutation({
    mutationFn: async ({ clientId, password }: { clientId: string; password: string }) =>
      api('/api/portal/reset-password', { clientId, password }),
    onSuccess: () => {
      toast.success('Password updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to reset password', { description: error.message });
    },
  });
};
