ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS service_paused_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pause_start_date date,
  ADD COLUMN IF NOT EXISTS pause_end_date date;