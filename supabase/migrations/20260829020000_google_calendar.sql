-- ============================================================
-- Google Calendar / Meet integration for appointments
-- ============================================================
-- Stores the OAuth refresh token for the one Google account (Dr. Aamit
-- Shah's) that appointments get scheduled on, and the Meet link/event id
-- generated per appointment.
--
-- google_calendar_connections is intentionally given NO RLS policies at
-- all — RLS is enabled with zero grants, so both `anon` and `authenticated`
-- get zero rows/writes. Only the service-role client in server.js (which
-- bypasses RLS entirely) can read or write it. A refresh token is a
-- long-lived credential; it must never be reachable from the browser.

CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_email text,
  refresh_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_google_calendar_connections_upd ON public.google_calendar_connections;
CREATE TRIGGER trg_google_calendar_connections_upd BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS meet_link text;
