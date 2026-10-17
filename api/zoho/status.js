import { getSupabaseAdmin, setCors } from '../_lib/zohoClient.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return res.status(200).json({ connected: false });

  const { data: connection } = await supabaseAdmin
    .from('zoho_calendar_connections')
    .select('connected_email')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  res.status(200).json({ connected: !!connection, email: connection?.connected_email ?? null });
}
