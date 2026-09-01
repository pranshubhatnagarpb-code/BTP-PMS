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
    const { data: appointment } = await supabaseAdmin
      .from('appointments')
      .select('google_event_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (appointment?.google_event_id) {
      const authClient = await getConnectedGoogleClient();
      if (authClient) {
        const calendar = google.calendar({ version: 'v3', auth: authClient });
        try {
          await calendar.events.delete({ calendarId: 'primary', eventId: appointment.google_event_id, sendUpdates: 'all' });
        } catch (err) {
          // Event may already be gone (e.g. deleted manually in Google Calendar) — not fatal.
          console.warn('Could not delete Google Calendar event (continuing):', err.message);
        }
      }
    }

    await supabaseAdmin
      .from('appointments')
      .update({ google_event_id: null, meet_link: null })
      .eq('id', appointmentId);

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete calendar event' });
  }
}
