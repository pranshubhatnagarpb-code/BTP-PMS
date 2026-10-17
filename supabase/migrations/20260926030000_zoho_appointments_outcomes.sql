-- ============================================================
-- Zoho Calendar integration + appointment outcomes & diet follow-ups
-- ============================================================

-- Zoho OAuth refresh token for the one account appointments are scheduled on.
-- Like google_calendar_connections: RLS enabled with NO policies, so only the
-- service-role client on the server can read or write it. A refresh token is a
-- long-lived credential and must never be reachable from the browser.
create table if not exists public.zoho_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connected_email text,
  refresh_token text not null,
  calendar_uid text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.zoho_calendar_connections enable row level security;

drop trigger if exists trg_zoho_calendar_connections_upd on public.zoho_calendar_connections;
create trigger trg_zoho_calendar_connections_upd before update on public.zoho_calendar_connections
  for each row execute function public.update_updated_at_column();

alter table public.appointments
  -- physical: in person, no diet follow-up reminder
  -- online / physical_online: diet follow-up reminder 48h after the meeting is marked held
  add column if not exists meeting_mode text not null default 'online',
  add column if not exists zoho_event_uid text,
  add column if not exists zoho_calendar_uid text,
  -- What happened, recorded when staff close the appointment.
  add column if not exists outcome text,
  add column if not exists outcome_notes text,
  add column if not exists outcome_recorded_at timestamptz,
  -- Diet plan follow-up after a held meeting; staff can push the due date.
  add column if not exists diet_followup_due_at timestamptz,
  add column if not exists diet_followup_done_at timestamptz;

alter table public.appointments drop constraint if exists appointments_meeting_mode_check;
alter table public.appointments add constraint appointments_meeting_mode_check
  check (meeting_mode in ('physical', 'online', 'physical_online'));

alter table public.appointments drop constraint if exists appointments_outcome_check;
alter table public.appointments add constraint appointments_outcome_check
  check (outcome is null or outcome in ('held', 'no_show', 'cancelled', 'other'));

create index if not exists idx_appointments_diet_followup_due
  on public.appointments (diet_followup_due_at)
  where diet_followup_due_at is not null and diet_followup_done_at is null;
