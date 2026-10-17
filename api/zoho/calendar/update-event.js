// Moves an appointment's Zoho Calendar event to its new date/time after a
// reschedule, keeping the same event and Zoho Meeting link.
import {
  getSupabaseAdmin,
  getConnectedZoho,
  zohoCalendarRequest,
  buildEventData,
  findMeetingLink,
  loadAppointment,
  rejectRequest,
} from '../../_lib/zohoClient.js';

export default async function handler(req, res) {
  if (rejectRequest(req, res)) return;
  const { appointmentId } = req.body;

  try {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (!appointment.zoho_event_uid) return res.status(200).json({ skipped: true });

    const zoho = await getConnectedZoho();
    if (!zoho) return res.status(409).json({ error: 'Zoho Calendar is not connected.' });

    const path = `/calendars/${appointment.zoho_calendar_uid || zoho.calendarUid}/events/${appointment.zoho_event_uid}`;
    // Zoho requires the event's current etag on every update.
    const current = await zohoCalendarRequest(zoho.accessToken, 'GET', path);
    const etag = current.events?.[0]?.etag;
    if (etag === undefined) throw new Error('Could not read the Zoho event before updating it');

    const { eventdata } = buildEventData(appointment);
    const data = await zohoCalendarRequest(zoho.accessToken, 'PUT', path, { eventdata: { ...eventdata, etag } });

    const meetLink = findMeetingLink(data.events?.[0]) || appointment.meet_link;
    if (meetLink !== appointment.meet_link) {
      await getSupabaseAdmin().from('appointments').update({ meet_link: meetLink }).eq('id', appointmentId);
    }

    res.status(200).json({ success: true, meetLink });
  } catch (error) {
    console.error('Error updating Zoho Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update calendar event' });
  }
}
