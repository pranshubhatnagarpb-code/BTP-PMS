
CREATE TABLE public.diet_chart_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.diet_chart_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all diet_chart_templates"
  ON public.diet_chart_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert diet_chart_templates"
  ON public.diet_chart_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update diet_chart_templates"
  ON public.diet_chart_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete diet_chart_templates"
  ON public.diet_chart_templates FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_diet_chart_templates_updated_at
  BEFORE UPDATE ON public.diet_chart_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
