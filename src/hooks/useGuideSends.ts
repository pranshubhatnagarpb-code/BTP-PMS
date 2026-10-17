import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type GuideSendChannel = 'whatsapp' | 'email' | 'in_person' | 'other';

export const CHANNEL_LABELS: Record<GuideSendChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  in_person: 'In person',
  other: 'Other',
};

export interface GuideSend {
  id: string;
  guide_id: string | null;
  guide_title: string;
  client_id: string;
  sent_on: string;
  channel: GuideSendChannel;
  notes: string | null;
  created_at: string;
  clients: { id: string; name: string } | null;
}

const QUERY_KEY = ['guide-sends'];

// Every send, newest first. Small enough to load whole: one row per guide sent.
export const useGuideSends = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guide_sends')
        .select('*, clients ( id, name )')
        .order('sent_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as GuideSend[];
    },
  });
};

export const useRecordGuideSends = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ guide, clientIds, sentOn, channel, notes }: {
      guide: { id: string | null; title: string };
      clientIds: string[];
      sentOn: string;
      channel: GuideSendChannel;
      notes?: string;
    }) => {
      const { error } = await supabase.from('guide_sends').insert(
        clientIds.map((clientId) => ({
          guide_id: guide.id,
          guide_title: guide.title,
          client_id: clientId,
          sent_on: sentOn,
          channel,
          notes: notes?.trim() || null,
        })),
      );
      if (error) throw error;
    },
    onSuccess: (_data, { clientIds }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      clientIds.forEach((id) => queryClient.invalidateQueries({ queryKey: ['client-timeline', id] }));
    },
    onError: (error: Error) => toast.error('Failed to record guide as sent', { description: error.message }),
  });
};

export const useDeleteGuideSend = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (send: Pick<GuideSend, 'id' | 'client_id'>) => {
      const { error } = await supabase.from('guide_sends').delete().eq('id', send.id);
      if (error) throw error;
    },
    onSuccess: (_data, send) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['client-timeline', send.client_id] });
    },
    onError: (error: Error) => toast.error('Failed to remove record', { description: error.message }),
  });
};

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
