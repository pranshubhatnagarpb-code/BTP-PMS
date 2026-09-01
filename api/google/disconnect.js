import { supabaseAdmin, setCors } from '../_lib/googleClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase service role is not configured' });
  }
  await supabaseAdmin.from('google_calendar_connections').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  res.status(200).json({ success: true });
}
