-- Add custom_title column to diet_plans table
ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS custom_title text;
