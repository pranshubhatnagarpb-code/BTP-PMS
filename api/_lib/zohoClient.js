// Shared helpers for the Zoho Calendar endpoints under api/zoho/**. server.js
// (local dev) mounts these same handlers, so there is one implementation.
//
// Environment (read lazily — server.js loads .env after imports are evaluated):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REDIRECT_URI  — from api-console.zoho.in
//   ZOHO_ACCOUNTS_URL  default https://accounts.zoho.in
//   ZOHO_CALENDAR_API  default https://calendar.zoho.in/api/v1
import { createClient } from '@supabase/supabase-js';

export const ZOHO_SCOPES = [
  'ZohoCalendar.calendar.READ',
  'ZohoCalendar.event.ALL',
  // Required for conference: 'zmeeting' (the Zoho Meeting link on the event)
  'ZohoMeeting.meeting.ALL',
  'AaaServer.profile.READ',
].join(',');

export const APPOINTMENT_TYPE_LABELS = {
  consultation: 'First Counselling',
  follow_up: 'Follow Up',
  prospect_call: 'Prospect Call',
  diet_review: 'Diet Review',
  checkup: 'Checkup',
};

// Clinic addresses for the event location. Keep in sync with src/config/clinic.ts.
const CLINIC_LOCATIONS = {
  mulund_west: 'Mulund West Clinic: B/5, Surya Prakash Bldg, Above Dena Bank, M.G. Rd, Mulund West, Mumbai-400080',
  mulund_east: 'Mulund East Clinic: Office No. 107, 1st Floor, HS Pearl (Shilpa), opposite ICICI Bank, above HS Group, Sane Guruji Nagar, Mumbai, Maharashtra 400081',
};

// Event colours. Keep in sync with src/lib/appointmentColors.ts.
const COLOR_HEX = {
  orange: '#F97316', green: '#16A34A', pink: '#EC4899', blue: '#3B82F6', red: '#EF4444',
  purple: '#A855F7', teal: '#14B8A6', yellow: '#EAB308', indigo: '#6366F1', brown: '#92400E', gray: '#6B7280',
};

// The staff-picked colour, else automatic: prospect call, online, then clinic.
const eventColor = (appointment) => {
  if (COLOR_HEX[appointment.color]) return COLOR_HEX[appointment.color];
  if (appointment.appointment_type === 'prospect_call') return COLOR_HEX.pink;
  if (appointment.meeting_mode === 'online') return COLOR_HEX.blue;
  if (appointment.clinic_location === 'mulund_east') return COLOR_HEX.orange;
  if (appointment.clinic_location === 'mulund_west') return COLOR_HEX.green;
  return COLOR_HEX.gray;
};

// Only these modes get a Zoho Meeting link; physical appointments are in person.
export const ONLINE_MODES = ['online', 'physical_online'];

// Fallback length for appointments without duration_minutes.
const DEFAULT_MEETING_MINUTES = 30;

export const zohoConfig = () => ({
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  redirectUri: process.env.ZOHO_REDIRECT_URI,
  accountsUrl: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.in',
  calendarApi: process.env.ZOHO_CALENDAR_API || 'https://calendar.zoho.in/api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8080',
});

export const isZohoConfigured = () => {
  const c = zohoConfig();
  return Boolean(c.clientId && c.clientSecret && c.redirectUri);
};

let adminClient;
// Service-role client. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export const getSupabaseAdmin = () => {
  if (adminClient !== undefined) return adminClient;
  adminClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
    : null;
  return adminClient;
};

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export async function exchangeToken(params) {
  const { accountsUrl, clientId, clientSecret, redirectUri } = zohoConfig();
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, ...params });
  const res = await fetch(`${accountsUrl}/oauth/v2/token`, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Zoho token request failed: ${data.error || res.status}`);
  return data;
}

// Calls the Zoho Calendar API with a fresh access token.
export async function zohoCalendarRequest(accessToken, method, path, { eventdata, headers } = {}) {
  const { calendarApi } = zohoConfig();
  const url = new URL(`${calendarApi}${path}`);
  if (eventdata) url.searchParams.set('eventdata', JSON.stringify(eventdata));
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}`, ...headers },
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const detail = data?.error?.[0]?.description || data?.message || data?.raw || res.status;
    if (/meeting scope invalid/i.test(String(detail))) {
      throw new Error(
        'Zoho Calendar is connected without the Zoho Meeting permission. Activate Zoho Meeting for this account (sign in once at meeting.zoho.in), then reconnect Zoho from the Appointments page.'
      );
    }
    const error = new Error(`Zoho Calendar request failed: ${detail}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Access tokens last an hour; reuse one until shortly before it expires. Zoho
// allows only ~10 token requests per 10 minutes, so requesting one per call
// gets the account blocked ("Access Denied — too many requests").
const TOKEN_EXPIRY_MARGIN_MS = 5 * 60 * 1000;
// Per server instance; the database copy covers other (serverless) instances.
let tokenCache = null; // { refreshToken, accessToken, scope, expiresAt }
// After Zoho rate-limits token requests, stop asking for a while — each further
// attempt can extend the block.
const RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;
let tokenBlockedUntil = 0;

const isFresh = (expiresAt) => expiresAt && new Date(expiresAt).getTime() - TOKEN_EXPIRY_MARGIN_MS > Date.now();

// Returns { accessToken, calendarUid, canCreateMeetings } for the connected
// account, or null if nobody has connected Zoho yet.
export async function getConnectedZoho() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!isZohoConfigured() || !supabaseAdmin) return null;

  // select('*') so this keeps working before the token-cache columns exist.
  const { data: connection } = await supabaseAdmin
    .from('zoho_calendar_connections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!connection) return null;

  const result = (accessToken, scope) => ({
    accessToken,
    calendarUid: connection.calendar_uid,
    canCreateMeetings: hasMeetingScope(scope),
  });

  if (tokenCache?.refreshToken === connection.refresh_token && isFresh(tokenCache.expiresAt)) {
    return result(tokenCache.accessToken, tokenCache.scope);
  }
  if (connection.access_token && isFresh(connection.access_token_expires_at)) {
    tokenCache = {
      refreshToken: connection.refresh_token,
      accessToken: connection.access_token,
      scope: connection.access_token_scope,
      expiresAt: connection.access_token_expires_at,
    };
    return result(connection.access_token, connection.access_token_scope);
  }

  if (Date.now() < tokenBlockedUntil) {
    throw new Error('Zoho is temporarily limiting requests. Please try again in a few minutes.');
  }
  let tokens;
  try {
    tokens = await exchangeToken({ grant_type: 'refresh_token', refresh_token: connection.refresh_token });
  } catch (error) {
    if (/access denied|too many/i.test(error.message)) {
      tokenBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
      throw new Error('Zoho is temporarily limiting requests. Please try again in a few minutes.');
    }
    throw error;
  }
  const expiresAt = new Date(Date.now() + (Number(tokens.expires_in) || 3600) * 1000).toISOString();
  tokenCache = { refreshToken: connection.refresh_token, accessToken: tokens.access_token, scope: tokens.scope, expiresAt };
  const { error } = await supabaseAdmin
    .from('zoho_calendar_connections')
    .update({ access_token: tokens.access_token, access_token_scope: tokens.scope ?? null, access_token_expires_at: expiresAt })
    .eq('id', connection.id);
  if (error) console.warn('Could not cache the Zoho access token (run the token-cache migration):', error.message);
  return result(tokens.access_token, tokens.scope);
}

// Zoho Meeting is a separate (paid) Zoho product. Accounts with only Zoho
// Calendar don't get this scope, and asking for a meeting link then fails with
// "Meeting scope invalid" — so events are created without a link instead.
export const hasMeetingScope = (scope) =>
  String(scope || '').split(/[\s,]+/).includes('ZohoMeeting.meeting.ALL');

// "2026-09-30" + "10:00[:00]" in IST -> Zoho's "20260930T100000+0530".
const toZohoDateTime = (date, time, minutes) => {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Wall-clock IST arithmetic done in UTC fields, so the server's timezone never matters.
  const start = Date.UTC(y, m - 1, d, hh, mm);
  const fmt = (ms) => {
    const t = new Date(ms);
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00+0530`;
  };
  return { start: fmt(start), end: fmt(start + minutes * 60 * 1000) };
};

// --- Zoho date-times <-> IST wall clock (appointments store IST date + time) ---

const IST_OFFSET_MS = 330 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

// Zoho date-times look like "20261006T100000+0530" or "20261006T043000Z".
export const parseZohoDateTime = (value) => {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z|[+-]\d{4})?$/.exec(String(value || ''));
  if (!m) return null;
  const [, y, mo, d, h, mi, se, tz] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (tz && tz !== 'Z') {
    const sign = tz[0] === '-' ? -1 : 1;
    ms -= sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5))) * 60 * 1000;
  }
  return ms;
};

// Epoch ms -> IST wall clock as stored on appointments.
export const toIst = (ms) => {
  const t = new Date(ms + IST_OFFSET_MS);
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:00`,
  };
};

export const istDateCompact = (ms) => toIst(ms).date.replace(/-/g, '');

// The slot an event occupies, or null for all-day / unreadable events.
export const eventSlot = (event) => {
  const start = parseZohoDateTime(event?.dateandtime?.start);
  const end = parseZohoDateTime(event?.dateandtime?.end);
  if (start === null || end === null || end <= start) return null;
  return { ...toIst(start), duration: Math.round((end - start) / 60000) };
};

// Title used when the appointment has no custom title. The sync compares Zoho's
// title against this to tell whether someone renamed the event in Zoho.
export const defaultEventTitle = (appointment) => {
  const typeLabel = APPOINTMENT_TYPE_LABELS[appointment.appointment_type] || appointment.appointment_type;
  return `${typeLabel} — ${appointment.clients?.name ?? 'Client'} (Bounce The Pound)`;
};

export const eventTitle = (appointment) => appointment.title?.trim() || defaultEventTitle(appointment);

export const buildEventData = (appointment) => {
  const { start, end } = toZohoDateTime(
    appointment.appointment_date,
    appointment.appointment_time,
    appointment.duration_minutes || DEFAULT_MEETING_MINUTES,
  );
  // The client is deliberately not added as an attendee: Zoho would email them on
  // booking and on every change. Staff share the details (and meeting link) themselves.
  return {
    eventdata: {
      title: eventTitle(appointment),
      description: appointment.notes || '',
      color: eventColor(appointment),
      dateandtime: { timezone: 'Asia/Kolkata', start, end },
      ...(CLINIC_LOCATIONS[appointment.clinic_location] ? { location: CLINIC_LOCATIONS[appointment.clinic_location] } : {}),
    },
  };
};

// Zoho's event response nests the Zoho Meeting details in a structure that
// isn't pinned down in its docs, so find the join URL wherever it appears.
export function findMeetingLink(value) {
  if (typeof value === 'string') {
    return /^https:\/\/meeting\.zoho\.[a-z.]+\//i.test(value) ? value : null;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) {
      const found = findMeetingLink(v);
      if (found) return found;
    }
  }
  return null;
}

export async function loadAppointment(appointmentId) {
  const { data, error } = await getSupabaseAdmin()
    .from('appointments')
    .select('id, appointment_date, appointment_time, appointment_type, meeting_mode, clinic_location, duration_minutes, title, color, notes, zoho_event_uid, zoho_calendar_uid, meet_link, clients(name, email)')
    .eq('id', appointmentId)
    .single();
  if (error || !data) return null;
  return data;
}

// Common guard for the calendar endpoints. Returns an error response or null.
export function rejectRequest(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return true; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return true; }
  if (!getSupabaseAdmin()) { res.status(500).json({ error: 'Supabase service role is not configured' }); return true; }
  if (!req.body?.appointmentId) { res.status(400).json({ error: 'appointmentId is required' }); return true; }
  return false;
}
