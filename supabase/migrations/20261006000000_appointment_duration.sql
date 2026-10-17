-- How long an appointment runs; the Zoho Calendar event blocks this many minutes.
-- Existing appointments keep the previous fixed length of 30 minutes.
alter table public.appointments
  add column if not exists duration_minutes integer not null default 30;

alter table public.appointments drop constraint if exists appointments_duration_minutes_check;
alter table public.appointments add constraint appointments_duration_minutes_check
  check (duration_minutes between 5 and 480);
