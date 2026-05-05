ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS google_event_id text,
ADD COLUMN IF NOT EXISTS google_synced_at timestamp with time zone;