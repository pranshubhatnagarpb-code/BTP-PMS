-- Manual diet planner: custom meal times with several options each, picked from
-- meal options / recipes or typed by hand. Stored per day as
--   [{ "time": "Breakfast", "options": [{ "text": "Poha", "optionId": "<diet_options.id>" | null }] }]
-- The old breakfast/lunch/snacks/dinner_option_id columns are still filled when
-- those meal times use a meal option, so older screens keep working.
alter table public.diet_plan_days
  add column if not exists meals jsonb not null default '[]'::jsonb;
