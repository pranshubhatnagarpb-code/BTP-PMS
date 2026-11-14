// Supabase clients for the server (server.js locally, the Netlify function live).
// supabase-js needs a WebSocket for its realtime client and only finds one built
// into Node.js 22+; Netlify runs functions on older Node versions, where creating
// a client crashed the whole API at startup. Passing the `ws` package works on any
// Node version. (The server never uses realtime; the client is just created.)
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

export const createServerClient = (url, key, options = {}) =>
  createClient(url, key, { ...options, realtime: { ...options.realtime, transport: WebSocket } });
