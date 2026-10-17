-- Caches the Zoho access token (valid ~1 hour) so the app doesn't request a new
-- one on every Zoho call. Zoho allows only ~10 token requests per 10 minutes and
-- answers "Access Denied — too many requests" beyond that.
alter table public.zoho_calendar_connections
  add column if not exists access_token text,
  add column if not exists access_token_scope text,
  add column if not exists access_token_expires_at timestamptz;
