// Lists meetings booked directly in Zoho Calendar (not created by the PMS) for
// a date range, so the PMS calendar can show them and staff can add them as
// appointments. Events already linked to an appointment are left out — those
// show as the appointment itself.
//
// POST { start: 'yyyy-mm-dd', end: 'yyyy-mm-dd' }  (inclusive, at most 31 days)
// -> { events: [{ uid, calendarUid, title, date, time, duration, allDay, endDate,
//                 location, description, meetLink, recurring }] }
import {
  getSupabaseAdmin,
  getConnectedZoho,
  zohoCalendarRequest,
  setCors,
  eventSlot,
  findMeetingLink,
} from '../../_lib/zohoClient.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 31;

const compact = (date) => date.replace(/-/g, '');
// "20261017" -> "2026-10-17"
const fromCompact = (value) => {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(value || ''));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const toEvent = (event, calendarUid) => {
  const base = {
    uid: event.uid,
    calendarUid,
    title: typeof event.title === 'string' && event.title.trim() ? event.title.trim() : '(No title)',
    location: event.location || null,
    description: typeof event.description === 'string' ? event.description : null,
    meetLink: findMeetingLink(event),
    // Occurrences of a repeating event share one uid, so one can't be linked
    // to a single appointment (the sync would move it to the series' start).
    recurring: Boolean(event.rrule || event.recurrenceid || event.isrep),
  };
  if (event.isallday) {
    const date = fromCompact(event.dateandtime?.start);
    if (!date) return null;
    // Zoho's all-day end is the day after the last day.
    const end = fromCompact(event.dateandtime?.end);
    const last = end ? new Date(`${end}T00:00:00Z`) : null;
    if (last) last.setUTCDate(last.getUTCDate() - 1);
    const endDate = last && last.toISOString().slice(0, 10) >= date ? last.toISOString().slice(0, 10) : date;
    return { ...base, allDay: true, date, endDate, time: null, duration: null };
  }
  const slot = eventSlot(event);
  if (!slot) return null;
  return { ...base, allDay: false, date: slot.date, endDate: slot.date, time: slot.time, duration: slot.duration };
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { start, end } = req.body || {};
  if (!DATE.test(start || '') || !DATE.test(end || '') || end < start) {
    return res.status(400).json({ error: 'start and end (yyyy-mm-dd) are required' });
  }
  if ((Date.parse(end) - Date.parse(start)) / 86400000 + 1 > MAX_RANGE_DAYS) {
    return res.status(400).json({ error: `Range can be at most ${MAX_RANGE_DAYS} days` });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase service role is not configured' });

  try {
    const zoho = await getConnectedZoho();
    if (!zoho) return res.status(200).json({ events: [], skipped: true, reason: 'not_connected' });

    const range = JSON.stringify({ start: compact(start), end: compact(end) });
    const data = await zohoCalendarRequest(
      zoho.accessToken,
      'GET',
      `/calendars/${zoho.calendarUid}/events?range=${encodeURIComponent(range)}`,
    );
    const listed = (data.events || []).filter((e) => e.uid && !e.isdeleted);

    // Skip events that already belong to an appointment.
    const uids = [...new Set(listed.map((e) => e.uid))];
    const linked = new Set();
    for (let i = 0; i < uids.length; i += 200) {
      const { data: rows, error } = await supabase
        .from('appointments')
        .select('zoho_event_uid')
        .in('zoho_event_uid', uids.slice(i, i + 200));
      if (error) throw error;
      (rows || []).forEach((r) => linked.add(r.zoho_event_uid));
    }

    const events = listed
      .filter((e) => !linked.has(e.uid))
      .map((e) => toEvent(e, zoho.calendarUid))
      .filter(Boolean)
      .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`));

    res.status(200).json({ events });
  } catch (error) {
    console.error('Error listing Zoho Calendar events:', error);
    res.status(500).json({ error: error?.message || 'Failed to list Zoho Calendar events' });
  }
}
