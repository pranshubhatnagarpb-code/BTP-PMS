import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Guide {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  updated_at: string;
}

const BUCKET = 'guides';
const QUERY_KEY = ['guides'];
export const MAX_GUIDE_BYTES = 50 * 1024 * 1024;

// Public bucket: this link opens the PDF without logging in.
export const guideUrl = (guide: Pick<Guide, 'file_path'>) =>
  supabase.storage.from(BUCKET).getPublicUrl(guide.file_path).data.publicUrl;

// "Diabetes-Diet guide (v2).pdf" -> "Diabetes Diet guide (v2)"
export const titleFromFileName = (name: string) =>
  name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

// Storage keys must be URL-safe; a random prefix keeps links unguessable and unique.
const storagePath = (fileName: string) => {
  const safe = fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'guide';
  return `${crypto.randomUUID()}/${safe}.pdf`;
};

export const useGuides = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('guides').select('*').order('title');
      if (error) throw error;
      return data as Guide[];
    },
  });
};

export const useUploadGuide = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, category }: { file: File; category?: string }) => {
      const path = storagePath(file.name);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from('guides').insert({
        title: titleFromFileName(file.name),
        category: category?.trim() || null,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
      });
      if (error) {
        // Don't leave an orphaned file behind if the record couldn't be saved.
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
};

export const useUpdateGuide = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Pick<Guide, 'id' | 'title' | 'description' | 'category'>) => {
      const { error } = await supabase.from('guides').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => toast.error('Failed to update guide', { description: error.message }),
  });
};

export const useDeleteGuide = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (guide: Guide) => {
      const { error } = await supabase.from('guides').delete().eq('id', guide.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([guide.file_path]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (error: Error) => toast.error('Failed to delete guide', { description: error.message }),
  });
};
