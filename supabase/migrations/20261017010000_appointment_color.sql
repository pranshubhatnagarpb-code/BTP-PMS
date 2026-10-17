-- Optional calendar colour picked by staff. Null means automatic: the app colours
-- the appointment by type / meeting mode / clinic (see src/lib/appointmentColors.ts).
alter table public.appointments
  add column if not exists color text;

alter table public.appointments drop constraint if exists appointments_color_check;
alter table public.appointments add constraint appointments_color_check
  check (color is null or color in (
    'orange', 'green', 'pink', 'blue', 'red',
    'purple', 'teal', 'yellow', 'indigo', 'brown', 'gray'
  ));
