-- Dashboard diet plan reminders fire on day 5, day 10, then every 10th day of a
-- client's latest approved plan. This records the last reminder milestone
-- (5, 10, 20, …) staff marked done, hiding it until the next milestone.
alter table public.diet_plans
  add column if not exists reminder_done_day integer;
