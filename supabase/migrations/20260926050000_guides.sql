-- ============================================================
-- Client guides: PDF library shared with clients by link
-- ============================================================
-- PDFs live in the public "guides" storage bucket, so a shared link opens
-- without logging in. Links are unguessable (random prefix) and the bucket
-- can't be listed publicly; only staff can upload, replace, or delete files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guides', 'guides', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "staff upload guides" on storage.objects;
create policy "staff upload guides" on storage.objects for insert to authenticated
  with check (bucket_id = 'guides' and public.portal_client_id() is null);

drop policy if exists "staff update guides" on storage.objects;
create policy "staff update guides" on storage.objects for update to authenticated
  using (bucket_id = 'guides' and public.portal_client_id() is null);

drop policy if exists "staff delete guides" on storage.objects;
create policy "staff delete guides" on storage.objects for delete to authenticated
  using (bucket_id = 'guides' and public.portal_client_id() is null);

create table if not exists public.guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  file_path text not null unique,
  file_name text not null,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guides enable row level security;

drop policy if exists "staff only guides" on public.guides;
create policy "staff only guides" on public.guides for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop trigger if exists trg_guides_upd on public.guides;
create trigger trg_guides_upd before update on public.guides
  for each row execute function public.update_updated_at_column();
