ALTER TABLE public.meal_recipes
  RENAME COLUMN meal_name TO "Meal_name";

ALTER TABLE public.meal_recipes
  RENAME COLUMN recipe_text TO "Instructions";

ALTER TABLE public.meal_recipes
  ADD COLUMN IF NOT EXISTS "Ingredients" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "Remarks" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.normalize_meal_recipe_name(_meal_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(lower(coalesce(_meal_name, '')), '[^a-z0-9]+', '', 'g')
$$;

UPDATE public.meal_recipes
SET meal_name_normalized = public.normalize_meal_recipe_name("Meal_name")
WHERE meal_name_normalized IS DISTINCT FROM public.normalize_meal_recipe_name("Meal_name");

CREATE OR REPLACE FUNCTION public.set_meal_recipe_normalized_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.meal_name_normalized := public.normalize_meal_recipe_name(NEW."Meal_name");
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_meal_recipe_normalized_name ON public.meal_recipes;
CREATE TRIGGER set_meal_recipe_normalized_name
BEFORE INSERT OR UPDATE OF "Meal_name" ON public.meal_recipes
FOR EACH ROW
EXECUTE FUNCTION public.set_meal_recipe_normalized_name();