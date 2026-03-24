import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TemplateMeal {
  time: string;
  meal: string;
  alternatives: string;
  notes: string;
}

export interface TemplateDay {
  day: string;
  meals: TemplateMeal[];
}

export interface DietChartTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template_data: TemplateDay[];
  instructions: string | null;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ['diet_chart_templates'];

export const useDietChartTemplates = () => {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_chart_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as DietChartTemplate[]).map(t => ({
        ...t,
        template_data: (typeof t.template_data === 'string' 
          ? JSON.parse(t.template_data) 
          : t.template_data) as TemplateDay[],
      }));
    },
  });
};

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (template: { name: string; description?: string; category: string; template_data: TemplateDay[]; instructions?: string }) => {
      const { data, error } = await supabase
        .from('diet_chart_templates')
        .insert({
          name: template.name,
          description: template.description || null,
          category: template.category,
          template_data: JSON.parse(JSON.stringify(template.template_data)),
          instructions: template.instructions || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template created successfully!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useUpdateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...template }: { id: string; name: string; description?: string; category: string; template_data: TemplateDay[]; instructions?: string }) => {
      const { data, error } = await supabase
        .from('diet_chart_templates')
        .update({
          name: template.name,
          description: template.description || null,
          category: template.category,
          template_data: JSON.parse(JSON.stringify(template.template_data)),
          instructions: template.instructions || null,
        } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template updated!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};

export const useDeleteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('diet_chart_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success('Template deleted!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
};
