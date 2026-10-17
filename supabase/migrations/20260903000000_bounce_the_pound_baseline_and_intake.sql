-- ============================================================
-- Bounce The Pound — full baseline schema + intake wiring
-- ============================================================
-- The live Supabase project backing this app currently has ZERO tables:
-- none of the older migrations in this folder were ever applied to it.
-- Those older files are also internally inconsistent — 20260427122821
-- re-creates tables that 20260117115035 already created (no DROP in
-- between, so running everything in order fails), and several columns
-- the frontend actually reads/writes (clients.client_code, .supplements,
-- .pause_start_date, .pause_end_date, .service_paused_days) exist in NO
-- migration file at all. 20260505081523 also seeds a stray login
-- (amit@frommonday.in / "Dr. Aamit Shah") left over from a previous
-- white-label instance of this codebase — not applicable here.
--
-- This single file is the full, consistent schema for a fresh project.
-- Run ONLY this file (skip every other file in this folder) in the
-- Supabase SQL editor. It's written with IF NOT EXISTS / DROP ... IF
-- EXISTS throughout so it's also safe to re-run.
--
-- It additionally adds `intake_submissions`, the table the public
-- wellness-intake-hub-main app writes to, so the "view full intake
-- response" eye icon on the Clients page has something to read.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Shared trigger function
-- ------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

-- ------------------------------------------------------------
-- Employees
-- ------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null default 'Staff',
  department text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Clients
-- ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique,
  name text not null,
  email text,
  phone text,
  address text,
  date_of_birth date,
  anniversary_date date,
  weight decimal(5,2),
  height decimal(5,2),
  health_conditions text[],
  supplements text,
  total_receivables decimal(10,2) default 0,
  total_fees numeric default 0,
  is_active boolean default true,
  notes text,
  gender text,
  skin_type text,
  hair_type text,
  goal text,
  diet_preference text,
  category text not null default 'standard'
    check (category in ('standard','premium','premium_plus')),
  service_start_date date,
  service_duration_months numeric,
  number_of_diet_charts integer,
  employee_id uuid references public.employees(id),
  pause_start_date date,
  pause_end_date date,
  service_paused_days integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfills `category` onto a `clients` table that already existed before
-- this column was added to the baseline above (CREATE TABLE IF NOT EXISTS
-- above is a no-op in that case). No-ops itself once the column is present,
-- so this file stays safe to re-run.
alter table public.clients
  add column if not exists category text not null default 'standard'
    check (category in ('standard','premium','premium_plus'));

comment on column public.clients.gender is 'Client gender: male, female, other';
comment on column public.clients.skin_type is 'Skin type: oily, dry, combination, normal, sensitive';
comment on column public.clients.hair_type is 'Hair type: oily, dry, normal, dandruff-prone, color-treated';
comment on column public.clients.goal is 'Health goal: weight_loss, weight_gain, maintain, muscle_building, disease_management';
comment on column public.clients.diet_preference is 'Diet preference: vegetarian, non-vegetarian, vegan, eggetarian';
comment on column public.clients.category is 'Client service tier: standard, premium, premium_plus';
comment on column public.clients.total_fees is 'Total fees charged to client';
comment on column public.clients.total_receivables is 'Balance amount still owed by client';

-- Auto-assign client_code (CL-0001, CL-0002, ...) on insert when the
-- caller doesn't supply one. The PMS UI generates one client-side before
-- inserting; the public intake-hub server function does not, so this
-- keeps every client numbered without duplicating that logic there.
create sequence if not exists public.client_code_seq;

create or replace function public.assign_client_code()
returns trigger as $$
begin
  if new.client_code is null then
    new.client_code := 'CL-' || lpad(nextval('public.client_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_clients_client_code on public.clients;
create trigger trg_clients_client_code
  before insert on public.clients
  for each row execute function public.assign_client_code();

-- ------------------------------------------------------------
-- Appointments
-- ------------------------------------------------------------
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  appointment_type text not null default 'consultation',
  status text not null default 'scheduled',
  notes text,
  google_event_id text,
  meet_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Google Calendar / Meet integration: stores the OAuth refresh token for
-- the account appointments get scheduled on. Deliberately has NO RLS
-- policies — RLS is enabled with zero grants, so only the service-role
-- client in server.js (which bypasses RLS) can read or write it. A
-- refresh token is a long-lived credential; it must never be reachable
-- from the browser via the anon/authenticated roles.
create table if not exists public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connected_email text,
  refresh_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

drop trigger if exists trg_google_calendar_connections_upd on public.google_calendar_connections;
create trigger trg_google_calendar_connections_upd before update on public.google_calendar_connections
  for each row execute function public.update_updated_at_column();

create table if not exists public.appointment_reschedules (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  previous_date date not null,
  previous_time time not null,
  new_date date not null,
  new_time time not null,
  rescheduled_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Diet plans
-- ------------------------------------------------------------
create table if not exists public.diet_options (
  id uuid primary key default gen_random_uuid(),
  meal_type text not null check (meal_type in ('breakfast','lunch','snacks','dinner')),
  name text not null,
  calories integer not null default 0,
  category text not null default 'general',
  is_vegetarian boolean not null default true,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plan_name text not null,
  custom_title text,
  start_date date,
  end_date date,
  instructions text,
  status text not null default 'draft' check (status in ('draft','active','completed','approved')),
  week_number integer default 1,
  ai_plan_data jsonb,
  is_ai_generated boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diet_plan_days (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references public.diet_plans(id) on delete cascade,
  day_label text not null,
  breakfast_option_id uuid references public.diet_options(id),
  lunch_option_id uuid references public.diet_options(id),
  snacks_option_id uuid references public.diet_options(id),
  dinner_option_id uuid references public.diet_options(id),
  total_calories integer default 0,
  notes text,
  sort_order integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.diet_chart_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'general',
  template_data jsonb not null default '[]'::jsonb,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_recipes (
  id uuid primary key default gen_random_uuid(),
  "Meal_name" text not null,
  meal_name_normalized text not null unique,
  "Instructions" text not null,
  "Ingredients" text not null default '',
  "Remarks" text not null default '',
  created_at timestamptz not null default now()
);

create or replace function public.normalize_meal_recipe_name(_meal_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(coalesce(_meal_name, '')), '[^a-z0-9]+', '', 'g')
$$;

create or replace function public.set_meal_recipe_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.meal_name_normalized := public.normalize_meal_recipe_name(new."Meal_name");
  return new;
end;
$$;

drop trigger if exists set_meal_recipe_normalized_name on public.meal_recipes;
create trigger set_meal_recipe_normalized_name
before insert or update of "Meal_name" on public.meal_recipes
for each row execute function public.set_meal_recipe_normalized_name();

-- ------------------------------------------------------------
-- Billing / leads
-- ------------------------------------------------------------
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  service_name text not null,
  amount decimal(10,2) not null,
  due_date date not null,
  paid_amount decimal(10,2) default 0,
  status text not null default 'pending' check (status in ('pending','partial','paid','overdue')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  lead_name text not null,
  phone text,
  email text,
  followup_date date not null,
  followup_time time,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Body measurements / blood reports
-- ------------------------------------------------------------
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  measurement_date date not null,
  weight numeric,
  bmi numeric,
  body_fat_percent numeric,
  waist numeric,
  hip numeric,
  chest numeric,
  thigh numeric,
  arm numeric,
  neck numeric,
  calf numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  report_date date not null,
  lab_name text,
  source_file_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blood_report_values (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.blood_reports(id) on delete cascade,
  hemoglobin numeric,
  fasting_blood_sugar numeric,
  postprandial_blood_sugar numeric,
  hba1c numeric,
  total_cholesterol numeric,
  triglycerides numeric,
  hdl numeric,
  ldl numeric,
  vldl numeric,
  vitamin_d numeric,
  vitamin_b12 numeric,
  tsh numeric,
  uric_acid numeric,
  creatinine numeric,
  iron numeric,
  ferritin numeric,
  calcium numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Client portal (client-pwa login) support tables
-- ------------------------------------------------------------
create table if not exists public.client_portal_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.client_feedback (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  feedback_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_progress_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  product_name_normalized text not null,
  link text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Restaurant menus — AI-extracted healthy picks from an uploaded menu,
-- cached per restaurant (keyed by normalized name) so staff only need
-- to upload/analyze a given restaurant's menu once. `summary_text` is
-- the ready-to-copy-paste message staff send to clients; `healthy_options`
-- is the same data structured for the on-screen list.
-- ------------------------------------------------------------
create table if not exists public.restaurant_menus (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  restaurant_name_normalized text not null unique,
  location text,
  healthy_options jsonb not null default '[]'::jsonb,
  summary_text text not null default '',
  employee_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.normalize_restaurant_name(_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(coalesce(_name, '')), '[^a-z0-9]+', '', 'g')
$$;

create or replace function public.set_restaurant_name_normalized()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.restaurant_name_normalized := public.normalize_restaurant_name(new.restaurant_name);
  return new;
end;
$$;

drop trigger if exists set_restaurant_name_normalized on public.restaurant_menus;
create trigger set_restaurant_name_normalized
before insert or update of restaurant_name on public.restaurant_menus
for each row execute function public.set_restaurant_name_normalized();

-- ------------------------------------------------------------
-- Intake submissions — written by wellness-intake-hub-main's public
-- intake form. `pms_lead_id` holds the matching clients.id (as text)
-- once a submission has been synced into `clients`; the Clients page
-- eye icon reads this table by matching on that column.
-- ------------------------------------------------------------
create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  branch text not null check (branch in ('female','male','child')),
  age integer check (age >= 0 and age <= 120),
  dob date,

  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (char_length(phone) <= 32),
  email text check (char_length(email) <= 254),
  city text check (char_length(city) <= 120),

  guardian_name text check (char_length(guardian_name) <= 120),
  guardian_relationship text check (char_length(guardian_relationship) <= 60),
  guardian_phone text check (char_length(guardian_phone) <= 32),
  guardian_email text check (char_length(guardian_email) <= 254),

  payload jsonb not null default '{}'::jsonb,

  pms_lead_id text,
  pms_status text not null default 'pending'
    check (pms_status in ('pending','sent','failed','duplicate_merged')),
  pms_error text,
  pms_attempts integer not null default 0,
  pms_sent_at timestamptz,

  constraint contact_required check (
    (phone is not null and char_length(phone) > 0)
    or (email is not null and char_length(email) > 0)
    or (guardian_phone is not null and char_length(guardian_phone) > 0)
  )
);

create index if not exists intake_submissions_created_at_idx
  on public.intake_submissions (created_at desc);
create index if not exists intake_submissions_pms_status_idx
  on public.intake_submissions (pms_status);
create index if not exists intake_submissions_pms_lead_id_idx
  on public.intake_submissions (pms_lead_id);
create index if not exists intake_submissions_phone_idx
  on public.intake_submissions (phone);
create index if not exists intake_submissions_email_idx
  on public.intake_submissions (email);

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.employees enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_reschedules enable row level security;
alter table public.diet_options enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_plan_days enable row level security;
alter table public.diet_chart_templates enable row level security;
alter table public.meal_recipes enable row level security;
alter table public.receivables enable row level security;
alter table public.lead_followups enable row level security;
alter table public.body_measurements enable row level security;
alter table public.blood_reports enable row level security;
alter table public.blood_report_values enable row level security;
alter table public.client_portal_users enable row level security;
alter table public.client_feedback enable row level security;
alter table public.client_progress_entries enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.client_notes enable row level security;
alter table public.restaurant_menus enable row level security;
alter table public.intake_submissions enable row level security;

-- Helper: the client_id linked to the current auth user, or NULL if the
-- current user is staff (not a portal client). SECURITY DEFINER so it
-- can read client_portal_users even though that table's own RLS
-- restricts direct access.
create or replace function public.portal_client_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.client_portal_users where user_id = auth.uid() limit 1;
$$;

-- employees: staff only
drop policy if exists "staff only employees" on public.employees;
create policy "staff only employees" on public.employees for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

-- clients: portal client may only see their own row
drop policy if exists "select clients" on public.clients;
drop policy if exists "staff insert clients" on public.clients;
drop policy if exists "staff update clients" on public.clients;
drop policy if exists "staff delete clients" on public.clients;
create policy "select clients" on public.clients for select to authenticated
  using (public.portal_client_id() is null or id = public.portal_client_id());
create policy "staff insert clients" on public.clients for insert to authenticated
  with check (public.portal_client_id() is null);
create policy "staff update clients" on public.clients for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete clients" on public.clients for delete to authenticated
  using (public.portal_client_id() is null);

-- appointments: portal client sees only their own
drop policy if exists "select appointments" on public.appointments;
drop policy if exists "staff insert appointments" on public.appointments;
drop policy if exists "staff update appointments" on public.appointments;
drop policy if exists "staff delete appointments" on public.appointments;
create policy "select appointments" on public.appointments for select to authenticated
  using (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "staff insert appointments" on public.appointments for insert to authenticated
  with check (public.portal_client_id() is null);
create policy "staff update appointments" on public.appointments for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete appointments" on public.appointments for delete to authenticated
  using (public.portal_client_id() is null);

drop policy if exists "select appointment_reschedules" on public.appointment_reschedules;
drop policy if exists "staff insert appointment_reschedules" on public.appointment_reschedules;
create policy "select appointment_reschedules" on public.appointment_reschedules for select to authenticated
  using (public.portal_client_id() is null);
create policy "staff insert appointment_reschedules" on public.appointment_reschedules for insert to authenticated
  with check (public.portal_client_id() is null);

-- diet_plans: portal client sees only their own, read-only
drop policy if exists "select diet_plans" on public.diet_plans;
drop policy if exists "staff insert diet_plans" on public.diet_plans;
drop policy if exists "staff update diet_plans" on public.diet_plans;
drop policy if exists "staff delete diet_plans" on public.diet_plans;
create policy "select diet_plans" on public.diet_plans for select to authenticated
  using (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "staff insert diet_plans" on public.diet_plans for insert to authenticated
  with check (public.portal_client_id() is null);
create policy "staff update diet_plans" on public.diet_plans for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete diet_plans" on public.diet_plans for delete to authenticated
  using (public.portal_client_id() is null);

-- staff-only catalogs / internal tables
drop policy if exists "staff only diet_options" on public.diet_options;
create policy "staff only diet_options" on public.diet_options for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop policy if exists "staff only diet_plan_days" on public.diet_plan_days;
create policy "staff only diet_plan_days" on public.diet_plan_days for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop policy if exists "staff only diet_chart_templates" on public.diet_chart_templates;
create policy "staff only diet_chart_templates" on public.diet_chart_templates for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop policy if exists "staff only receivables" on public.receivables;
create policy "staff only receivables" on public.receivables for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop policy if exists "staff only lead_followups" on public.lead_followups;
create policy "staff only lead_followups" on public.lead_followups for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

-- meal_recipes: generic content, readable by anyone authenticated; writes staff-only
drop policy if exists "authenticated read meal_recipes" on public.meal_recipes;
drop policy if exists "staff insert meal_recipes" on public.meal_recipes;
drop policy if exists "staff update meal_recipes" on public.meal_recipes;
drop policy if exists "staff delete meal_recipes" on public.meal_recipes;
create policy "authenticated read meal_recipes" on public.meal_recipes for select to authenticated using (true);
create policy "staff insert meal_recipes" on public.meal_recipes for insert to authenticated
  with check (public.portal_client_id() is null);
create policy "staff update meal_recipes" on public.meal_recipes for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete meal_recipes" on public.meal_recipes for delete to authenticated
  using (public.portal_client_id() is null);

-- body_measurements / blood_reports: portal client can read + self-log their own
drop policy if exists "select body_measurements" on public.body_measurements;
drop policy if exists "insert body_measurements" on public.body_measurements;
drop policy if exists "staff update body_measurements" on public.body_measurements;
drop policy if exists "staff delete body_measurements" on public.body_measurements;
create policy "select body_measurements" on public.body_measurements for select to authenticated
  using (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "insert body_measurements" on public.body_measurements for insert to authenticated
  with check (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "staff update body_measurements" on public.body_measurements for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete body_measurements" on public.body_measurements for delete to authenticated
  using (public.portal_client_id() is null);

drop policy if exists "select blood_reports" on public.blood_reports;
drop policy if exists "insert blood_reports" on public.blood_reports;
drop policy if exists "staff update blood_reports" on public.blood_reports;
drop policy if exists "staff delete blood_reports" on public.blood_reports;
create policy "select blood_reports" on public.blood_reports for select to authenticated
  using (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "insert blood_reports" on public.blood_reports for insert to authenticated
  with check (public.portal_client_id() is null or client_id = public.portal_client_id());
create policy "staff update blood_reports" on public.blood_reports for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete blood_reports" on public.blood_reports for delete to authenticated
  using (public.portal_client_id() is null);

drop policy if exists "select blood_report_values" on public.blood_report_values;
drop policy if exists "insert blood_report_values" on public.blood_report_values;
drop policy if exists "staff update blood_report_values" on public.blood_report_values;
drop policy if exists "staff delete blood_report_values" on public.blood_report_values;
create policy "select blood_report_values" on public.blood_report_values for select to authenticated
  using (
    public.portal_client_id() is null
    or exists (
      select 1 from public.blood_reports br
      where br.id = blood_report_values.report_id and br.client_id = public.portal_client_id()
    )
  );
create policy "insert blood_report_values" on public.blood_report_values for insert to authenticated
  with check (
    public.portal_client_id() is null
    or exists (
      select 1 from public.blood_reports br
      where br.id = blood_report_values.report_id and br.client_id = public.portal_client_id()
    )
  );
create policy "staff update blood_report_values" on public.blood_report_values for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete blood_report_values" on public.blood_report_values for delete to authenticated
  using (public.portal_client_id() is null);

-- client portal support tables
drop policy if exists "staff manage client_portal_users" on public.client_portal_users;
drop policy if exists "portal user reads own link" on public.client_portal_users;
create policy "staff manage client_portal_users" on public.client_portal_users for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);
create policy "portal user reads own link" on public.client_portal_users for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "staff manage client_feedback" on public.client_feedback;
drop policy if exists "portal reads own client_feedback" on public.client_feedback;
create policy "staff manage client_feedback" on public.client_feedback for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);
create policy "portal reads own client_feedback" on public.client_feedback for select to authenticated
  using (client_id = public.portal_client_id());

drop policy if exists "staff manage client_progress_entries" on public.client_progress_entries;
drop policy if exists "portal reads own client_progress_entries" on public.client_progress_entries;
drop policy if exists "portal inserts own client_progress_entries" on public.client_progress_entries;
create policy "staff manage client_progress_entries" on public.client_progress_entries for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);
create policy "portal reads own client_progress_entries" on public.client_progress_entries for select to authenticated
  using (client_id = public.portal_client_id());
create policy "portal inserts own client_progress_entries" on public.client_progress_entries for insert to authenticated
  with check (client_id = public.portal_client_id());

drop policy if exists "authenticated read affiliate_products" on public.affiliate_products;
drop policy if exists "staff insert affiliate_products" on public.affiliate_products;
drop policy if exists "staff update affiliate_products" on public.affiliate_products;
drop policy if exists "staff delete affiliate_products" on public.affiliate_products;
create policy "authenticated read affiliate_products" on public.affiliate_products for select to authenticated using (true);
create policy "staff insert affiliate_products" on public.affiliate_products for insert to authenticated
  with check (public.portal_client_id() is null);
create policy "staff update affiliate_products" on public.affiliate_products for update to authenticated
  using (public.portal_client_id() is null);
create policy "staff delete affiliate_products" on public.affiliate_products for delete to authenticated
  using (public.portal_client_id() is null);

-- client_notes: staff only (dated notes log, not exposed to the client portal)
drop policy if exists "select client_notes" on public.client_notes;
drop policy if exists "staff insert client_notes" on public.client_notes;
create policy "select client_notes" on public.client_notes for select to authenticated
  using (public.portal_client_id() is null);
create policy "staff insert client_notes" on public.client_notes for insert to authenticated
  with check (public.portal_client_id() is null);

-- restaurant_menus: staff only — never exposed to the client portal.
drop policy if exists "staff only restaurant_menus" on public.restaurant_menus;
create policy "staff only restaurant_menus" on public.restaurant_menus for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

-- intake_submissions: staff only — raw intake data, viewed via the
-- Clients page eye icon. The public intake form itself writes here
-- using the service-role key (bypasses RLS), so no anon/portal access
-- is needed.
drop policy if exists "select intake_submissions" on public.intake_submissions;
create policy "select intake_submissions" on public.intake_submissions for select to authenticated
  using (public.portal_client_id() is null);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
drop trigger if exists trg_clients_upd on public.clients;
create trigger trg_clients_upd before update on public.clients for each row execute function public.update_updated_at_column();
drop trigger if exists trg_employees_upd on public.employees;
create trigger trg_employees_upd before update on public.employees for each row execute function public.update_updated_at_column();
drop trigger if exists trg_appointments_upd on public.appointments;
create trigger trg_appointments_upd before update on public.appointments for each row execute function public.update_updated_at_column();
drop trigger if exists trg_diet_plans_upd on public.diet_plans;
create trigger trg_diet_plans_upd before update on public.diet_plans for each row execute function public.update_updated_at_column();
drop trigger if exists trg_receivables_upd on public.receivables;
create trigger trg_receivables_upd before update on public.receivables for each row execute function public.update_updated_at_column();
drop trigger if exists trg_lead_followups_upd on public.lead_followups;
create trigger trg_lead_followups_upd before update on public.lead_followups for each row execute function public.update_updated_at_column();
drop trigger if exists trg_diet_chart_templates_upd on public.diet_chart_templates;
create trigger trg_diet_chart_templates_upd before update on public.diet_chart_templates for each row execute function public.update_updated_at_column();
drop trigger if exists trg_body_measurements_upd on public.body_measurements;
create trigger trg_body_measurements_upd before update on public.body_measurements for each row execute function public.update_updated_at_column();
drop trigger if exists trg_blood_reports_upd on public.blood_reports;
create trigger trg_blood_reports_upd before update on public.blood_reports for each row execute function public.update_updated_at_column();
drop trigger if exists trg_blood_report_values_upd on public.blood_report_values;
create trigger trg_blood_report_values_upd before update on public.blood_report_values for each row execute function public.update_updated_at_column();
drop trigger if exists trg_client_feedback_upd on public.client_feedback;
create trigger trg_client_feedback_upd before update on public.client_feedback for each row execute function public.update_updated_at_column();
drop trigger if exists trg_client_progress_entries_upd on public.client_progress_entries;
create trigger trg_client_progress_entries_upd before update on public.client_progress_entries for each row execute function public.update_updated_at_column();
drop trigger if exists trg_restaurant_menus_upd on public.restaurant_menus;
create trigger trg_restaurant_menus_upd before update on public.restaurant_menus for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_clients_dob on public.clients(date_of_birth);
create index if not exists idx_clients_anniv on public.clients(anniversary_date);
create index if not exists idx_appointments_date on public.appointments(appointment_date);
create index if not exists idx_diet_plans_client on public.diet_plans(client_id);
create index if not exists idx_receivables_due_date on public.receivables(due_date);
create index if not exists idx_receivables_status on public.receivables(status);
create index if not exists idx_lead_followups_date on public.lead_followups(followup_date);
create index if not exists idx_body_measurements_client on public.body_measurements(client_id);
create index if not exists idx_blood_reports_client on public.blood_reports(client_id);
create index if not exists idx_blood_report_values_report on public.blood_report_values(report_id);
create index if not exists idx_meal_recipes_normalized on public.meal_recipes(meal_name_normalized);
create index if not exists idx_client_feedback_client on public.client_feedback(client_id);
create index if not exists idx_client_progress_entries_client on public.client_progress_entries(client_id);
create index if not exists idx_affiliate_products_normalized on public.affiliate_products(product_name_normalized);
