-- Track record of which guide was sent to which client (marked manually by
-- staff after sending). guide_title is a snapshot so the record survives the
-- guide being renamed or deleted.
create table if not exists public.guide_sends (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.guides(id) on delete set null,
  guide_title text not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  sent_on date not null default current_date,
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp', 'email', 'in_person', 'other')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_guide_sends_client on public.guide_sends (client_id);
create index if not exists idx_guide_sends_guide on public.guide_sends (guide_id);

alter table public.guide_sends enable row level security;

drop policy if exists "staff only guide_sends" on public.guide_sends;
create policy "staff only guide_sends" on public.guide_sends for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);
