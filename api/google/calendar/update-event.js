// Patches the time on an appointment's existing Google Calendar event (used
// when an appointment is rescheduled). Keeps the same event id / Meet link —
// only start/end move. If the appointment never had an event, this is a
// no-op (the nutritionist can still use "Generate Link" afterwards).
import { google } from 'googleapis';
import { supabaseAdmin, getConnectedGoogleClient, setCors } from '../../_lib/googleClient.js';

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
    const { data: appointment, error: apptErr } = await supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, appointment_time, google_event_id')
      .eq('id', appointmentId)
      .single();
    if (apptErr || !appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!appointment.google_event_id) {
      // Nothing to patch — no Meet link had ever been generated for this appointment.
      return res.status(200).json({ success: true, skipped: true });
    }

    const authClient = await getConnectedGoogleClient();
    if (!authClient) {
      return res.status(409).json({
        error: 'Google Calendar is not connected yet. Connect it from the Appointments page first.',
      });
    }

    const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
    const startDate = new Date(startDateTime);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // same 30-minute default as create-event

    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const { data: event } = await calendar.events.patch({
      calendarId: 'primary',
      eventId: appointment.google_event_id,
      sendUpdates: 'all',
      requestBody: {
        start: { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' },
      },
    });

    res.status(200).json({ success: true, meetLink: event.hangoutLink || null, eventId: event.id });
  } catch (error) {
    console.error('Error updating Google Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update calendar event' });
  }
}
