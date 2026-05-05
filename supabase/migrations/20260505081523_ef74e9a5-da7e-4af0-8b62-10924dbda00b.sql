CREATE TABLE public.meal_recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_name TEXT NOT NULL,
  meal_name_normalized TEXT NOT NULL UNIQUE,
  recipe_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_meal_recipes_normalized ON public.meal_recipes(meal_name_normalized);

ALTER TABLE public.meal_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select meal_recipes" ON public.meal_recipes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert meal_recipes" ON public.meal_recipes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update meal_recipes" ON public.meal_recipes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth delete meal_recipes" ON public.meal_recipes FOR DELETE TO authenticated USING (true);