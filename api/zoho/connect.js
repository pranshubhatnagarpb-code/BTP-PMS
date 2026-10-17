// Redirects the admin's browser to Zoho's consent screen.
import { zohoConfig, isZohoConfigured, ZOHO_SCOPES, setCors } from '../_lib/zohoClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!isZohoConfigured()) {
    return res.status(500).send(
      'Zoho OAuth is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REDIRECT_URI in the environment and redeploy.'
    );
  }
  const { accountsUrl, clientId, redirectUri } = zohoConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: ZOHO_SCOPES,
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time, even on reconnect
  });
  res.redirect(`${accountsUrl}/oauth/v2/auth?${params}`);
}
