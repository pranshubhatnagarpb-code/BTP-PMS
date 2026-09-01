-- Dated notes log per client (staff-only), used alongside appointment /
-- reschedule history to build a full interaction timeline in the UI.
CREATE TABLE public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select client_notes" ON public.client_notes FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff insert client_notes" ON public.client_notes FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL);
