-- Recipe video links (YouTube / Instagram) for the recipe bank, imported from
-- the clinic's "Youtube Recipe links" document. Diet plan PDFs list these
-- links for every dish they mention. Link-only recipes have no written
-- Instructions, so that column's NOT NULL stays satisfied with ''.
alter table public.meal_recipes
  add column if not exists recipe_links text[] not null default '{}',
  add column if not exists category text;
