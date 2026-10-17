-- Editable supplement library (staff-only). The diet plan generator offers these
-- in a dropdown; a selected supplement is added to the plan as "<name> <directions>".
create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  directions text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplements enable row level security;

drop policy if exists "staff only supplements" on public.supplements;
create policy "staff only supplements" on public.supplements for all to authenticated
  using (public.portal_client_id() is null) with check (public.portal_client_id() is null);

drop trigger if exists trg_supplements_upd on public.supplements;
create trigger trg_supplements_upd before update on public.supplements
  for each row execute function public.update_updated_at_column();

-- Initial list, only when the table is empty so re-running never duplicates rows.
insert into public.supplements (name, directions, sort_order)
select v.name, v.directions, v.sort_order
from (values
  ('Uprise D3 60k IU', '* 8 weeks -- post lunch (weekly, on Sundays) // Take 1 capsule once a week for 4 weeks. After completing the 4-week course, continue with a maintenance dose of 1 capsule once a month for the next 6 months', 1),
  ('2B12', '* 30 days -- post breakfast', 2),
  ('Meganeuron OD +', '* 30 days -- post breakfast', 3),
  ('Supradyn/ Zincovit', '* 30 days -- post lunch', 4),
  ('Magnesium relax (brand- Miduty)', '* 60 days -- post dinner', 5),
  ('Omega 3 triple strength (brand- Curegarden)', '* 60 days -- post lunch [fish oil form]', 6),
  ('Vegan Omega 3 (brand- Carbamide forte/ Naturaltein)', '-- post lunch * 60 days', 7),
  ('Triple thyroid care (brand- Miduty)', '-- 60 days -- post dinner', 8),
  ('Thyrowell plus', '-- 30 days -- post breakfast', 9),
  ('Orofer XT syrup/ Dexorange syrup', '-- 1 spoon daily on rising (continue taking it regularly until a total of 2 bottles are completed; also have it with lime water for better iron absorption)', 10),
  ('Organic blood builder (brand- Miduty) / Livogen Z', '* 60 days -- on rising (have it alternate days/ daily along with lime water for better iron absorption)', 11),
  ('Ironemic', '* 30 days -- on rising (have it alternate days/ daily along with lime water for better iron absorption)', 12),
  ('Bizfer XT', '* 60 days -- on rising (have it alternate days/ daily along with lime water for better iron absorption)', 13),
  ('Limcee 500', '-- have 2 tabs daily, keeping a gap of approximately 6 hours between the two doses', 14),
  ('Berberine (brand- carbamide forte)', '-- post lunch * 30 days', 15),
  ('Unienzyme', '-- post lunch * 30 days', 16),
  ('CoQ10 (brand- carbamide forte)', '-- post breakfast * 30 days', 17),
  ('Ashwagandha (brand- Carbamide forte)', '-- post dinner * 60 days', 18),
  ('Leaky gut powder', '-- 1 scoop -- on rising -- kindly finish 2 sachets', 19),
  ('PCOS balance (brand- carbamide forte)', '-- post breakfast * 60 days', 20),
  ('Econorm sachet', '-- post lunch', 21),
  ('Evion 400', '-- post lunch * 30 days', 22),
  ('Primosa', '-- post lunch * 30 days', 23)
) as v(name, directions, sort_order)
where not exists (select 1 from public.supplements);
