-- ============================================================
-- Client portal: allow read-only access to meal_recipes
-- ============================================================
-- Context: the diet plan PDF downloaded from the PMS (SavedDietPlans /
-- AIDietPlanGenerator) appends a "Recipes for mentioned meals" section
-- by matching meal names in the plan against public.meal_recipes. The
-- client-pwa "Download PDF" action needs the same lookup so a client's
-- PDF matches the one staff download, but 20260829010000_client_portal.sql
-- locked meal_recipes to staff-only (FOR ALL, portal_client_id() IS NULL).
--
-- Recipe content (name/ingredients/instructions/remarks) is generic —
-- not tied to any individual client — so it's safe to expose read-only
-- to any authenticated user, the same pattern already used for
-- affiliate_products. Writes remain staff-only.

DROP POLICY IF EXISTS "staff only meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "authenticated read meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "staff insert meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "staff update meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "staff delete meal_recipes" ON public.meal_recipes;

CREATE POLICY "authenticated read meal_recipes" ON public.meal_recipes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert meal_recipes" ON public.meal_recipes
  FOR INSERT TO authenticated WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "staff update meal_recipes" ON public.meal_recipes
  FOR UPDATE TO authenticated USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete meal_recipes" ON public.meal_recipes
  FOR DELETE TO authenticated USING (public.portal_client_id() IS NULL);
