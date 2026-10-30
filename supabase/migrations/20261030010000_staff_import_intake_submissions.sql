-- Staff can add assessment form answers imported from a filled Word / PDF form
-- (Clients > Import client profile). The public intake form keeps writing with
-- the service-role key; client portal users still can't see or add any.
drop policy if exists "staff insert intake_submissions" on public.intake_submissions;
create policy "staff insert intake_submissions" on public.intake_submissions
  for insert to authenticated
  with check (public.portal_client_id() is null);

notify pgrst, 'reload schema';
