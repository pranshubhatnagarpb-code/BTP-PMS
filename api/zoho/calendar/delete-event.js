// Removes an appointment's Zoho Calendar event (e.g. on cancellation).
import { getSupabaseAdmin, getConnectedZoho, zohoCalendarRequest, loadAppointment, rejectRequest } from '../../_lib/zohoClient.js';

export default async function handler(req, res) {
  if (rejectRequest(req, res)) return;
  const { appointmentId } = req.body;

  try {
    const appointment = await loadAppointment(appointmentId);
    if (appointment?.zoho_event_uid) {
      const zoho = await getConnectedZoho();
      if (zoho) {
        const path = `/calendars/${appointment.zoho_calendar_uid || zoho.calendarUid}/events/${appointment.zoho_event_uid}`;
        try {
          const current = await zohoCalendarRequest(zoho.accessToken, 'GET', path);
          const etag = current.events?.[0]?.etag;
          await zohoCalendarRequest(zoho.accessToken, 'DELETE', path, { headers: { etag: String(etag) } });
        } catch (err) {
          // Event may already be gone (e.g. deleted in Zoho directly) — not fatal.
          console.warn('Could not delete Zoho Calendar event (continuing):', err.message);
        }
      }
    }

    await getSupabaseAdmin()
      .from('appointments')
      .update({ zoho_event_uid: null, zoho_calendar_uid: null, meet_link: null })
      .eq('id', appointmentId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting Zoho Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete calendar event' });
  }
}
