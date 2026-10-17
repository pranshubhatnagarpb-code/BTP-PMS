-- Allow long appointments (4/6/8 hr and full day). Upper bound is a whole day so
-- events resized in Zoho Calendar still sync back.
alter table public.appointments drop constraint if exists appointments_duration_minutes_check;
alter table public.appointments add constraint appointments_duration_minutes_check
  check (duration_minutes between 5 and 1440);
