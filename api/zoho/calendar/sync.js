// Pulls changes made directly in Zoho Calendar back into the PMS (Zoho -> PMS).
// For each upcoming scheduled appointment that has a Zoho event:
//   - event deleted in Zoho  -> appointment deleted from the PMS
//   - event moved / resized  -> appointment date, time and duration updated,
//                               with a row in the reschedule history
//   - event renamed          -> appointment title updated
// Run by the Appointments page and Dashboard when they open; safe to call often.
import {
  getSupabaseAdmin,
  getConnectedZoho,
  zohoCalendarRequest,
  setCors,
  eventTitle,
  defaultEventTitle,
  toIst,
  istDateCompact,
  eventSlot,
} from '../../_lib/zohoClient.js';

// Zoho's events list accepts at most a 31-day range.
const LIST_RANGE_DAYS = 30;
// Appointments changed in the PMS this recently are skipped: the matching Zoho
// update may still be in flight, and syncing then would undo the change.
const RECENT_EDIT_MS = 2 * 60 * 1000;

// Looks up one event. Returns the event, null when Zoho says it no longer
// exists, or undefined when the answer is unclear (network / auth trouble) —
// in which case the appointment is left alone.
async function fetchEvent(accessToken, calendarUid, eventUid) {
  try {
    const data = await zohoCalendarRequest(accessToken, 'GET', `/calendars/${calendarUid}/events/${eventUid}`);
    const event = data.events?.[0];
    if (!event || event.isdeleted) {
      console.info(`Zoho sync: event ${eventUid} ${event ? 'is marked deleted' : 'not returned'} by Zoho`);
      return null;
    }
    return event;
  } catch (error) {
    if (error.status === 404 || /not\s*(be\s*)?found|does\s*not\s*exist|no\s*such|deleted/i.test(error.message)) {
      console.info(`Zoho sync: event ${eventUid} gone (${error.status}): ${error.message}`);
      return null;
    }
    console.warn(`Zoho sync: could not read event ${eventUid}:`, error.message);
    return undefined;
  }
}

async function listEvents(accessToken, calendarUid, fromMs) {
  const range = JSON.stringify({
    start: istDateCompact(fromMs),
    end: istDateCompact(fromMs + LIST_RANGE_DAYS * 86400000),
  });
  try {
    const data = await zohoCalendarRequest(accessToken, 'GET', `/calendars/${calendarUid}/events?range=${encodeURIComponent(range)}`);
    return new Map((data.events || []).filter((e) => e.uid && !e.isdeleted).map((e) => [e.uid, e]));
  } catch (error) {
    // Fall back to looking each event up individually.
    console.warn('Zoho sync: listing events failed, checking one by one:', error.message);
    return new Map();
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: 'Supabase service role is not configured' });

  try {
    const zoho = await getConnectedZoho();
    if (!zoho) return res.status(200).json({ skipped: true, reason: 'not_connected', deleted: 0, moved: 0, renamed: 0 });

    const nowMs = Date.now();
    const today = toIst(nowMs).date;
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('id, appointment_date, appointment_time, appointment_type, duration_minutes, title, zoho_event_uid, zoho_calendar_uid, updated_at, clients(name)')
      .eq('status', 'scheduled')
      .not('zoho_event_uid', 'is', null)
      .gte('appointment_date', today);
    if (error) throw error;

    const byCalendar = new Map();
    for (const apt of appointments || []) {
      if (nowMs - new Date(apt.updated_at).getTime() < RECENT_EDIT_MS) continue;
      const cal = apt.zoho_calendar_uid || zoho.calendarUid;
      if (!byCalendar.has(cal)) byCalendar.set(cal, []);
      byCalendar.get(cal).push(apt);
    }

    let deleted = 0;
    let moved = 0;
    let renamed = 0;
    for (const [calendarUid, list] of byCalendar) {
      const listed = await listEvents(zoho.accessToken, calendarUid, nowMs);

      for (const apt of list) {
        const event = listed.get(apt.zoho_event_uid) ?? (await fetchEvent(zoho.accessToken, calendarUid, apt.zoho_event_uid));
        if (event === undefined) continue;

        if (event === null) {
          // Conditional on the same event, so two tabs syncing at once don't both count it.
          const { data: removed } = await supabase
            .from('appointments')
            .delete()
            .eq('id', apt.id)
            .eq('zoho_event_uid', apt.zoho_event_uid)
            .select('id');
          if (removed?.length) {
            console.info(`Zoho sync: deleted appointment ${apt.id} (${apt.appointment_date} ${apt.appointment_time}, ${apt.clients?.name ?? 'client'})`);
            deleted += 1;
          }
          continue;
        }

        // Renamed in Zoho: keep the new title (back to the default title clears it).
        const zohoTitle = typeof event.title === 'string' ? event.title.trim() : '';
        if (zohoTitle && zohoTitle !== eventTitle(apt)) {
          const newTitle = zohoTitle === defaultEventTitle(apt) ? null : zohoTitle;
          const { error: titleError } = await supabase.from('appointments').update({ title: newTitle }).eq('id', apt.id);
          if (!titleError) renamed += 1;
        }

        const slot = eventSlot(event);
        if (!slot) continue;
        const currentTime = apt.appointment_time.length === 5 ? `${apt.appointment_time}:00` : apt.appointment_time;
        const currentDuration = apt.duration_minutes || 30;
        if (slot.date === apt.appointment_date && slot.time === currentTime && slot.duration === currentDuration) continue;

        // Conditional on the old slot so a concurrent sync doesn't log the move twice.
        const { data: updated } = await supabase
          .from('appointments')
          .update({ appointment_date: slot.date, appointment_time: slot.time, duration_minutes: slot.duration })
          .eq('id', apt.id)
          .eq('appointment_date', apt.appointment_date)
          .eq('appointment_time', apt.appointment_time)
          .select('id');
        if (!updated?.length) continue;

        if (slot.date !== apt.appointment_date || slot.time !== currentTime) {
          await supabase.from('appointment_reschedules').insert({
            appointment_id: apt.id,
            previous_date: apt.appointment_date,
            previous_time: apt.appointment_time,
            new_date: slot.date,
            new_time: slot.time,
          });
        }
        moved += 1;
      }
    }

    res.status(200).json({ success: true, checked: appointments?.length ?? 0, deleted, moved, renamed });
  } catch (error) {
    console.error('Error syncing from Zoho Calendar:', error);
    res.status(500).json({ error: error?.message || 'Failed to sync from Zoho Calendar' });
  }
}
