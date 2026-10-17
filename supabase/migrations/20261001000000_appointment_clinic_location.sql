-- Which clinic a physical / physical + online appointment takes place at.
-- Null for online-only appointments (and for appointments created before this).
alter table public.appointments
  add column if not exists clinic_location text;

alter table public.appointments drop constraint if exists appointments_clinic_location_check;
alter table public.appointments add constraint appointments_clinic_location_check
  check (clinic_location is null or clinic_location in ('mulund_east', 'mulund_west'));
