-- Custom appointment title, shown in the PMS and used as the Zoho Calendar event
-- title. Null means the default "<Type> — <Client> (Bounce The Pound)".
-- Titles edited directly in Zoho are synced back into this column.
alter table public.appointments
  add column if not exists title text;
