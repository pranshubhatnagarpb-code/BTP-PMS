// Creates a Zoho Calendar event for any appointment so the slot is blocked,
// adds a Zoho Meeting link for online / physical+online ones, and writes
// zoho_event_uid / meet_link back onto the row.
import {
  getSupabaseAdmin,
  getConnectedZoho,
  zohoCalendarRequest,
  buildEventData,
  findMeetingLink,
  loadAppointment,
  rejectRequest,
  ONLINE_MODES,
} from '../../_lib/zohoClient.js';

export default async function handler(req, res) {
  if (rejectRequest(req, res)) return;
  const { appointmentId } = req.body;

  try {
    const appointment = await loadAppointment(appointmentId);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (appointment.zoho_event_uid) {
      return res.status(200).json({ meetLink: appointment.meet_link, alreadyExists: true });
    }

    const zoho = await getConnectedZoho();
    if (!zoho) {
      return res.status(409).json({
        error: 'Zoho Calendar is not connected yet. Connect it from the Appointments page first.',
      });
    }

    const { eventdata } = buildEventData(appointment);
    const isOnline = ONLINE_MODES.includes(appointment.meeting_mode);
    const data = await zohoCalendarRequest(zoho.accessToken, 'POST', `/calendars/${zoho.calendarUid}/events`, {
      // Physical meetings and calendar-only accounts get the event without a Zoho Meeting link
      eventdata: isOnline && zoho.canCreateMeetings ? { ...eventdata, conference: 'zmeeting' } : eventdata,
    });
    const event = data.events?.[0];
    if (!event?.uid) throw new Error('Zoho did not return the created event');

    const meetLink = findMeetingLink(event);
    await getSupabaseAdmin()
      .from('appointments')
      .update({ zoho_event_uid: event.uid, zoho_calendar_uid: zoho.calendarUid, meet_link: meetLink })
      .eq('id', appointmentId);

    res.status(200).json({ success: true, isOnline, meetLink, eventId: event.uid, meetingsAvailable: zoho.canCreateMeetings });
  } catch (error) {
    console.error('Error creating Zoho Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create calendar event' });
  }
}
