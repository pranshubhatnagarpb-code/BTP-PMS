## Single Fixed Google Calendar Sync — Dr. Amit Shah

### Redirect URI question — short answer

**You don't need one.** Lovable provides a managed Google Calendar connector. When you connect it, a Google sign-in popup opens, Dr. Amit Shah logs in once, and Lovable stores the token. No Google Cloud Console project, no OAuth client, no redirect URI to paste anywhere.

(The redirect URI list I gave earlier was only relevant for the per-user OAuth path, which you've now ruled out.)

### How sync will work

1. One-time setup: I trigger the connector linking flow → you/Dr. Shah click "Connect" → sign in with his Google account → done. Token is stored at the workspace level and auto-refreshes.
2. Every time the PMS creates / updates / cancels an appointment, a server function calls the Google Calendar API (via Lovable's connector gateway) to mirror it into his "primary" calendar.

### Implementation steps

1. **Link the connector**
   - Call `standard_connectors--connect` with `connector_id: google_calendar`. You'll see a prompt in chat to sign in with Dr. Shah's Google account. After this, `LOVABLE_API_KEY` + `GOOGLE_CALENDAR_API_KEY` are available to server code.

2. **Add Google event tracking to appointments**
   - Migration: add columns `google_event_id text` and `google_synced_at timestamptz` to `appointments` so we can update/delete the right calendar event later.

3. **Create server functions** (`src/server/google-calendar.functions.ts`)
   - `syncAppointmentToCalendar({ appointmentId })` — fetch appointment + client name, then:
     - If `google_event_id` is null → `POST /calendars/primary/events` (insert), store returned event id.
     - Else → `PATCH /calendars/primary/events/{id}` (update).
   - `deleteAppointmentFromCalendar({ appointmentId })` — `DELETE /calendars/primary/events/{id}`, clear stored id.
   - All calls go through `https://connector-gateway.lovable.dev/google_calendar/calendar/v3/...` with `Authorization: Bearer ${LOVABLE_API_KEY}` and `X-Connection-Api-Key: ${GOOGLE_CALENDAR_API_KEY}`. Errors are caught and surfaced as toast warnings (sync failure should not block the local appointment save).
   - Event payload: summary = `"<Type> — <Client name>"`, description = notes, start/end built from `appointment_date` + `appointment_time` (default 30 min duration), timezone `Asia/Kolkata`.

4. **Wire into existing hooks** (`src/hooks/useAppointments.ts`)
   - After successful insert in `useCreateAppointment` → call `syncAppointmentToCalendar`.
   - Add `useUpdateAppointment` (date/time/notes edits) → re-sync.
   - In `useUpdateAppointmentStatus` → if status becomes `cancelled` → call `deleteAppointmentFromCalendar`.

5. **Settings UI indicator** (small)
   - Show a "Google Calendar: Connected ✓ / Not connected" badge somewhere on the Appointments page header, with a "Reconnect" button that calls the connector reconnect flow if needed.

### Technical notes

- Connector is workspace-shared, so the same calendar is used regardless of which staff member is logged into the PMS — exactly what you want.
- All Google API calls happen server-side in `createServerFn` handlers; no Google credentials ever touch the browser.
- Existing appointments created before the connector was linked won't auto-sync; I can add a one-time "Backfill to Google Calendar" button if you want — let me know.

### Files to create / change

- migration: add `google_event_id`, `google_synced_at` to `appointments`
- new: `src/server/google-calendar.server.ts` (gateway helper)
- new: `src/server/google-calendar.functions.ts` (server fns)
- edit: `src/hooks/useAppointments.ts` (call sync on create/update/cancel)
- edit: `src/pages/Appointments.tsx` (connection status badge)

Approve and I'll connect the Google Calendar connector first (you'll get a sign-in prompt for Dr. Shah's account), then implement the sync.