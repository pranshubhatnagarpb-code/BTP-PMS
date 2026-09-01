-- ============================================================
-- Client portal: auth linkage + supporting tables + RLS lockdown
-- ============================================================
-- Context: the client-pwa app lets clients log in with Supabase Auth
-- (email + password) once staff "enable portal access" for them. That
-- makes portal clients real `authenticated` users — the same Postgres
-- role staff use. Every existing RLS policy in this project grants
-- `TO authenticated USING (true)`, so without this migration a portal
-- client would be able to read/write every other client's records,
-- billing, staff, and leads the moment their login is created.
--
-- This migration:
--   1. Adds client_portal_users (the auth-user <-> client link).
--   2. Adds the tables the client-pwa needs that don't exist yet
--      (client_feedback, client_progress_entries, affiliate_products).
--   3. Adds a portal_client_id() helper and replaces every blanket
--      "USING (true)" policy with one that scopes portal clients to
--      their own client_id (or denies them entirely on staff-only
--      tables like employees/receivables/lead_followups).
--
-- Idempotent: safe to re-run. DROP POLICY IF EXISTS covers every
-- historical policy name this project has used.

-- ------------------------------------------------------------
-- 1. New tables (must exist before portal_client_id() below —
--    a LANGUAGE SQL function is resolved against the catalog at
--    CREATE FUNCTION time, not lazily at first call).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.client_progress_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  weight_kg numeric,
  height_cm numeric,
  sleep_quality_rating smallint,
  digestion_rating smallint,
  energy_rating smallint,
  fatigue_rating smallint,
  skin_rating smallint,
  hair_rating smallint,
  acidity_rating smallint,
  bloating_rating smallint,
  constipation_rating smallint,
  sleep_hours numeric,
  water_intake text,
  activity_level text,
  screen_time_hrs numeric,
  stress_rating smallint,
  blood_parameters text[],
  inflammation_concerns boolean,
  meals_per_day smallint,
  packaged_food_frequency text,
  medications jsonb,
  periods_status text,
  period_flow text[],
  period_pain_severity smallint,
  pms_symptoms text[],
  libido_rating smallint,
  testosterone_status text,
  stamina_rating smallint,
  attention_rating smallint,
  memory_rating smallint,
  focus_rating smallint,
  appetite text,
  breastfed boolean,
  breastfeeding_duration_months smallint,
  formula_fed boolean,
  solids_start_age_months smallint,
  feeding_difficulties text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.affiliate_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  product_name_normalized text NOT NULL,
  link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_progress_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_client_feedback_upd ON public.client_feedback;
CREATE TRIGGER trg_client_feedback_upd BEFORE UPDATE ON public.client_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_client_progress_entries_upd ON public.client_progress_entries;
CREATE TRIGGER trg_client_progress_entries_upd BEFORE UPDATE ON public.client_progress_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_client_feedback_client ON public.client_feedback(client_id);
CREATE INDEX IF NOT EXISTS idx_client_progress_entries_client ON public.client_progress_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_normalized ON public.affiliate_products(product_name_normalized);

-- ------------------------------------------------------------
-- 2. Helper: the client_id linked to the current auth user, or
--    NULL if the current user is staff (not a portal client).
--    SECURITY DEFINER so it can read client_portal_users even
--    though that table's own RLS restricts direct access.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.portal_client_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id FROM public.client_portal_users WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ------------------------------------------------------------
-- 3. Policies for the new tables
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "staff manage client_portal_users" ON public.client_portal_users;
DROP POLICY IF EXISTS "portal user reads own link" ON public.client_portal_users;
CREATE POLICY "staff manage client_portal_users" ON public.client_portal_users
  FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL)
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "portal user reads own link" ON public.client_portal_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff manage client_feedback" ON public.client_feedback;
DROP POLICY IF EXISTS "portal reads own client_feedback" ON public.client_feedback;
CREATE POLICY "staff manage client_feedback" ON public.client_feedback
  FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL)
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "portal reads own client_feedback" ON public.client_feedback
  FOR SELECT TO authenticated
  USING (client_id = public.portal_client_id());

DROP POLICY IF EXISTS "staff manage client_progress_entries" ON public.client_progress_entries;
DROP POLICY IF EXISTS "portal reads own client_progress_entries" ON public.client_progress_entries;
DROP POLICY IF EXISTS "portal inserts own client_progress_entries" ON public.client_progress_entries;
CREATE POLICY "staff manage client_progress_entries" ON public.client_progress_entries
  FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL)
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "portal reads own client_progress_entries" ON public.client_progress_entries
  FOR SELECT TO authenticated
  USING (client_id = public.portal_client_id());
CREATE POLICY "portal inserts own client_progress_entries" ON public.client_progress_entries
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.portal_client_id());

DROP POLICY IF EXISTS "authenticated read affiliate_products" ON public.affiliate_products;
DROP POLICY IF EXISTS "staff insert affiliate_products" ON public.affiliate_products;
DROP POLICY IF EXISTS "staff update affiliate_products" ON public.affiliate_products;
DROP POLICY IF EXISTS "staff delete affiliate_products" ON public.affiliate_products;
CREATE POLICY "authenticated read affiliate_products" ON public.affiliate_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert affiliate_products" ON public.affiliate_products
  FOR INSERT TO authenticated WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "staff update affiliate_products" ON public.affiliate_products
  FOR UPDATE TO authenticated USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete affiliate_products" ON public.affiliate_products
  FOR DELETE TO authenticated USING (public.portal_client_id() IS NULL);

-- ------------------------------------------------------------
-- 4. Lock down existing tables: staff keep full access, portal
--    clients get scoped read (+ self-log insert on measurements/
--    blood reports), and zero access to staff-only tables.
-- ------------------------------------------------------------

-- clients: portal client may only see their own row.
DROP POLICY IF EXISTS "Authenticated users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can update clients" ON public.clients;
DROP POLICY IF EXISTS "Authenticated users can delete clients" ON public.clients;
DROP POLICY IF EXISTS "auth select clients" ON public.clients;
DROP POLICY IF EXISTS "auth insert clients" ON public.clients;
DROP POLICY IF EXISTS "auth update clients" ON public.clients;
DROP POLICY IF EXISTS "auth delete clients" ON public.clients;
CREATE POLICY "select clients" ON public.clients FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL OR id = public.portal_client_id());
CREATE POLICY "staff insert clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "staff update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- appointments: portal client sees only their own.
DROP POLICY IF EXISTS "Authenticated users can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can delete appointments" ON public.appointments;
DROP POLICY IF EXISTS "auth select appointments" ON public.appointments;
DROP POLICY IF EXISTS "auth insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "auth update appointments" ON public.appointments;
DROP POLICY IF EXISTS "auth delete appointments" ON public.appointments;
CREATE POLICY "select appointments" ON public.appointments FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "staff insert appointments" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "staff update appointments" ON public.appointments FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete appointments" ON public.appointments FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- diet_plans: portal client sees only their own, read-only.
DROP POLICY IF EXISTS "Authenticated users can view all diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Authenticated users can insert diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Authenticated users can update diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Authenticated users can delete diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "auth select diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "auth insert diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "auth update diet_plans" ON public.diet_plans;
DROP POLICY IF EXISTS "auth delete diet_plans" ON public.diet_plans;
CREATE POLICY "select diet_plans" ON public.diet_plans FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "staff insert diet_plans" ON public.diet_plans FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL);
CREATE POLICY "staff update diet_plans" ON public.diet_plans FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete diet_plans" ON public.diet_plans FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- body_measurements: portal client can read + self-log their own.
DROP POLICY IF EXISTS "auth select body_measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "auth insert body_measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "auth update body_measurements" ON public.body_measurements;
DROP POLICY IF EXISTS "auth delete body_measurements" ON public.body_measurements;
CREATE POLICY "select body_measurements" ON public.body_measurements FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "insert body_measurements" ON public.body_measurements FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "staff update body_measurements" ON public.body_measurements FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete body_measurements" ON public.body_measurements FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- blood_reports: portal client can read + self-log their own.
DROP POLICY IF EXISTS "auth select blood_reports" ON public.blood_reports;
DROP POLICY IF EXISTS "auth insert blood_reports" ON public.blood_reports;
DROP POLICY IF EXISTS "auth update blood_reports" ON public.blood_reports;
DROP POLICY IF EXISTS "auth delete blood_reports" ON public.blood_reports;
CREATE POLICY "select blood_reports" ON public.blood_reports FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "insert blood_reports" ON public.blood_reports FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL OR client_id = public.portal_client_id());
CREATE POLICY "staff update blood_reports" ON public.blood_reports FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete blood_reports" ON public.blood_reports FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- blood_report_values: scoped via the parent blood_reports row (no client_id column here).
DROP POLICY IF EXISTS "auth select blood_report_values" ON public.blood_report_values;
DROP POLICY IF EXISTS "auth insert blood_report_values" ON public.blood_report_values;
DROP POLICY IF EXISTS "auth update blood_report_values" ON public.blood_report_values;
DROP POLICY IF EXISTS "auth delete blood_report_values" ON public.blood_report_values;
CREATE POLICY "select blood_report_values" ON public.blood_report_values FOR SELECT TO authenticated
  USING (
    public.portal_client_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM public.blood_reports br
      WHERE br.id = blood_report_values.report_id AND br.client_id = public.portal_client_id()
    )
  );
CREATE POLICY "insert blood_report_values" ON public.blood_report_values FOR INSERT TO authenticated
  WITH CHECK (
    public.portal_client_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM public.blood_reports br
      WHERE br.id = blood_report_values.report_id AND br.client_id = public.portal_client_id()
    )
  );
CREATE POLICY "staff update blood_report_values" ON public.blood_report_values FOR UPDATE TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff delete blood_report_values" ON public.blood_report_values FOR DELETE TO authenticated
  USING (public.portal_client_id() IS NULL);

-- Staff-only tables: portal clients get zero access (billing, staff, leads, internal catalogs).
DROP POLICY IF EXISTS "Authenticated users can view all employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can insert employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can update employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users can delete employees" ON public.employees;
DROP POLICY IF EXISTS "auth select employees" ON public.employees;
DROP POLICY IF EXISTS "auth insert employees" ON public.employees;
DROP POLICY IF EXISTS "auth update employees" ON public.employees;
DROP POLICY IF EXISTS "auth delete employees" ON public.employees;
DROP POLICY IF EXISTS "staff only employees" ON public.employees;
CREATE POLICY "staff only employees" ON public.employees FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view all diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "Authenticated users can insert diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "Authenticated users can update diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "Authenticated users can delete diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "auth select diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "auth insert diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "auth update diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "auth delete diet_options" ON public.diet_options;
DROP POLICY IF EXISTS "staff only diet_options" ON public.diet_options;
CREATE POLICY "staff only diet_options" ON public.diet_options FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view all diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "Authenticated users can insert diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "Authenticated users can update diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "Authenticated users can delete diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "auth select diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "auth insert diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "auth update diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "auth delete diet_plan_days" ON public.diet_plan_days;
DROP POLICY IF EXISTS "staff only diet_plan_days" ON public.diet_plan_days;
CREATE POLICY "staff only diet_plan_days" ON public.diet_plan_days FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view all receivables" ON public.receivables;
DROP POLICY IF EXISTS "Authenticated users can insert receivables" ON public.receivables;
DROP POLICY IF EXISTS "Authenticated users can update receivables" ON public.receivables;
DROP POLICY IF EXISTS "Authenticated users can delete receivables" ON public.receivables;
DROP POLICY IF EXISTS "auth select receivables" ON public.receivables;
DROP POLICY IF EXISTS "auth insert receivables" ON public.receivables;
DROP POLICY IF EXISTS "auth update receivables" ON public.receivables;
DROP POLICY IF EXISTS "auth delete receivables" ON public.receivables;
DROP POLICY IF EXISTS "staff only receivables" ON public.receivables;
CREATE POLICY "staff only receivables" ON public.receivables FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view all lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "Authenticated users can insert lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "Authenticated users can update lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "Authenticated users can delete lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "auth select lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "auth insert lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "auth update lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "auth delete lead_followups" ON public.lead_followups;
DROP POLICY IF EXISTS "staff only lead_followups" ON public.lead_followups;
CREATE POLICY "staff only lead_followups" ON public.lead_followups FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "Authenticated users can view all diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "Authenticated users can insert diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "Authenticated users can update diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "Authenticated users can delete diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "auth select diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "auth insert diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "auth update diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "auth delete diet_chart_templates" ON public.diet_chart_templates;
DROP POLICY IF EXISTS "staff only diet_chart_templates" ON public.diet_chart_templates;
CREATE POLICY "staff only diet_chart_templates" ON public.diet_chart_templates FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);

DROP POLICY IF EXISTS "auth select meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "auth insert meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "auth update meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "auth delete meal_recipes" ON public.meal_recipes;
DROP POLICY IF EXISTS "staff only meal_recipes" ON public.meal_recipes;
CREATE POLICY "staff only meal_recipes" ON public.meal_recipes FOR ALL TO authenticated
  USING (public.portal_client_id() IS NULL) WITH CHECK (public.portal_client_id() IS NULL);
