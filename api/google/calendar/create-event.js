// Creates a Google Calendar event (with a Meet link) for an appointment and
// writes google_event_id/meet_link back onto the appointments row.
import { google } from 'googleapis';
import { supabaseAdmin, getConnectedGoogleClient, APPOINTMENT_TYPE_LABELS, setCors } from '../../_lib/googleClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase service role is not configured' });
  }
  const { appointmentId } = req.body || {};
  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  try {
    const authClient = await getConnectedGoogleClient();
    if (!authClient) {
      return res.status(409).json({
        error: 'Google Calendar is not connected yet. Connect it from the Appointments page first.',
      });
    }

    const { data: appointment, error: apptErr } = await supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, appointment_time, appointment_type, notes, clients(name, email)')
      .eq('id', appointmentId)
      .single();
    if (apptErr || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const typeLabel = APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type;
    const clientName = appointment.clients?.name ?? 'Client';
    const clientEmail = appointment.clients?.email || null;

    const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // 30-minute default

    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const { data: event } = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: clientEmail ? 'all' : 'none',
      requestBody: {
        summary: `${typeLabel} — ${clientName} (From Monday)`,
        description: appointment.notes || undefined,
        start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
        attendees: clientEmail ? [{ email: clientEmail }] : undefined,
        conferenceData: {
          createRequest: {
            requestId: `appt-${appointment.id}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });

    const meetLink = event.hangoutLink || null;
    await supabaseAdmin
      .from('appointments')
      .update({ google_event_id: event.id, meet_link: meetLink })
      .eq('id', appointmentId);

    res.status(200).json({ success: true, meetLink, eventId: event.id, invited: !!clientEmail });
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create calendar event' });
  }
}
