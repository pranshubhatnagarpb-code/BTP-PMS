// Redirects the admin's browser straight to Google's consent screen.
import { googleOAuthClient, GOOGLE_SCOPES, setCors } from '../_lib/googleClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const oauth2Client = googleOAuthClient();
  if (!oauth2Client) {
    return res.status(500).send(
      'Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in the environment and redeploy.'
    );
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time, even on reconnect
    scope: GOOGLE_SCOPES,
  });
  res.redirect(url);
}
