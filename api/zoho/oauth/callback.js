// Zoho redirects back here with ?code=... after the admin grants access.
import {
  zohoConfig,
  isZohoConfigured,
  getSupabaseAdmin,
  exchangeToken,
  zohoCalendarRequest,
  setCors,
} from '../../_lib/zohoClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseAdmin = getSupabaseAdmin();
  if (!isZohoConfigured() || !supabaseAdmin) {
    return res.status(500).send('Zoho OAuth or Supabase service role is not configured.');
  }
  const { frontendUrl, accountsUrl } = zohoConfig();
  const fail = (reason) => res.redirect(`${frontendUrl}/appointments?zoho_error=${encodeURIComponent(reason)}`);

  const { code, error } = req.query;
  if (error) return fail(error);
  if (!code) return fail('missing_code');

  try {
    const tokens = await exchangeToken({ grant_type: 'authorization_code', code });
    if (!tokens.refresh_token) return fail('no_refresh_token');

    // Events go on the account's default calendar.
    const { calendars = [] } = await zohoCalendarRequest(tokens.access_token, 'GET', '/calendars');
    const calendar = calendars.find((c) => c.isdefault) || calendars[0];
    if (!calendar?.uid) return fail('no_calendar_found');

    let connectedEmail = null;
    try {
      const infoRes = await fetch(`${accountsUrl}/oauth/user/info`, {
        headers: { Authorization: `Zoho-oauthtoken ${tokens.access_token}` },
      });
      const info = await infoRes.json();
      connectedEmail = info.Email ?? null;
    } catch {
      // Non-fatal — only used for display.
    }

    // Single active connection: replace whatever was there before.
    await supabaseAdmin.from('zoho_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const { error: insertErr } = await supabaseAdmin.from('zoho_calendar_connections').insert({
      refresh_token: tokens.refresh_token,
      calendar_uid: calendar.uid,
      connected_email: connectedEmail,
    });
    if (insertErr) throw insertErr;

    res.redirect(`${frontendUrl}/appointments?zoho_connected=1`);
  } catch (err) {
    console.error('Zoho OAuth callback error:', err);
    fail(err.message || 'unknown');
  }
}
