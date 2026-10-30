-- Diet guidelines (e.g. "Hives & Psoriasis") imported from Word documents.
-- content_html is the document converted to HTML (headings, lists, tables) on
-- import. Plans can append any of them to their PDF.
create table if not exists public.diet_guidelines (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  content_html text not null,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diet_guidelines enable row level security;

drop policy if exists "staff all diet_guidelines" on public.diet_guidelines;
create policy "staff all diet_guidelines" on public.diet_guidelines
  for all to authenticated
  using (public.portal_client_id() is null)
  with check (public.portal_client_id() is null);

drop trigger if exists trg_diet_guidelines_upd on public.diet_guidelines;
create trigger trg_diet_guidelines_upd before update on public.diet_guidelines
  for each row execute function public.update_updated_at_column();

-- Guidelines appended to a manual plan's PDF (AI plans keep theirs in ai_plan_data.guidelineIds).
alter table public.diet_plans
  add column if not exists guideline_ids uuid[] not null default '{}';

-- Make the API see the new table / column straight away.
notify pgrst, 'reload schema';
