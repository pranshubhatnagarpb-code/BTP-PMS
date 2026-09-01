-- Tracks reschedule history for appointments (previous/new date+time per
-- reschedule). Staff-only, same access pattern as appointments itself.
CREATE TABLE public.appointment_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  previous_date date NOT NULL,
  previous_time time NOT NULL,
  new_date date NOT NULL,
  new_time time NOT NULL,
  rescheduled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select appointment_reschedules" ON public.appointment_reschedules FOR SELECT TO authenticated
  USING (public.portal_client_id() IS NULL);
CREATE POLICY "staff insert appointment_reschedules" ON public.appointment_reschedules FOR INSERT TO authenticated
  WITH CHECK (public.portal_client_id() IS NULL);
