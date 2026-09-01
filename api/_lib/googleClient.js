// Shared helpers for the Google Calendar / Meet endpoints under api/google/**.
// Mirrors the logic in server.js (used for local dev) so both stay in sync.
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

// Service-role client for admin-only operations. Never expose
// SUPABASE_SERVICE_ROLE_KEY to the browser — it bypasses RLS entirely.
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  : null;

export const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';
export const APPOINTMENT_TYPE_LABELS = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  diet_review: 'Diet Review',
  checkup: 'Checkup',
};

export function googleOAuthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return null;
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Returns an authenticated OAuth2 client (refresh token loaded), or null if
// nobody has connected a Google account yet.
export async function getConnectedGoogleClient() {
  const oauth2Client = googleOAuthClient();
  if (!oauth2Client || !supabaseAdmin) return null;

  const { data: connection } = await supabaseAdmin
    .from('google_calendar_connections')
    .select('refresh_token')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!connection) return null;

  oauth2Client.setCredentials({ refresh_token: connection.refresh_token });
  return oauth2Client;
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
