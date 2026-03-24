ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS week_number integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS ai_plan_data jsonb,
ADD COLUMN IF NOT EXISTS is_ai_generated boolean DEFAULT false;