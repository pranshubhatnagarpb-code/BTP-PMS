// Google redirects back here with ?code=... after the admin grants access.
import { google } from 'googleapis';
import { googleOAuthClient, supabaseAdmin, FRONTEND_URL, setCors } from '../../_lib/googleClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const oauth2Client = googleOAuthClient();
  if (!oauth2Client || !supabaseAdmin) {
    return res.status(500).send('Google OAuth or Supabase service role is not configured.');
  }
  const { code, error } = req.query;
  if (error) {
    return res.redirect(`${FRONTEND_URL}/appointments?google_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/appointments?google_error=missing_code`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      // Happens if the admin had already granted access before and Google
      // didn't re-issue one — prompt=consent above should prevent this, but
      // guard anyway rather than silently storing nothing usable.
      return res.redirect(`${FRONTEND_URL}/appointments?google_error=no_refresh_token`);
    }
    oauth2Client.setCredentials(tokens);

    let connectedEmail = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();
      connectedEmail = userInfo.email ?? null;
    } catch {
      // Non-fatal — we can still operate without knowing the email to display.
    }

    // Single active connection: replace whatever was there before.
    await supabaseAdmin.from('google_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: insertErr } = await supabaseAdmin.from('google_calendar_connections').insert({
      refresh_token: tokens.refresh_token,
      connected_email: connectedEmail,
    });
    if (insertErr) throw insertErr;

    res.redirect(`${FRONTEND_URL}/appointments?google_connected=1`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${FRONTEND_URL}/appointments?google_error=${encodeURIComponent(err.message || 'unknown')}`);
  }
}
