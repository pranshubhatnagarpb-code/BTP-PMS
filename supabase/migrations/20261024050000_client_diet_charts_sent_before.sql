-- Diet charts a client already received before they were set up in the PMS
-- (clients onboarded from before the software). Counted in their "sent / total"
-- progress, and diet chart numbering continues after them.
alter table public.clients
  add column if not exists diet_charts_sent_before integer not null default 0
  check (diet_charts_sent_before >= 0);

notify pgrst, 'reload schema';
