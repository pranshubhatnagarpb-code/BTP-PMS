-- Daily blocks can differ per day of the week: each block lists the weekdays it
-- repeats on (0 = Sunday ... 6 = Saturday, as in JavaScript's getDay()).
-- Existing blocks keep applying to every day.
alter table public.recurring_blocks
  add column if not exists weekdays smallint[] not null default '{0,1,2,3,4,5,6}';

alter table public.recurring_blocks drop constraint if exists recurring_blocks_weekdays_check;
alter table public.recurring_blocks add constraint recurring_blocks_weekdays_check
  check (cardinality(weekdays) between 1 and 7 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]);
