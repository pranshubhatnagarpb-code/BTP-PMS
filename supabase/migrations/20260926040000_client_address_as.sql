-- Free-text note on how to address the client, e.g. "Pranshu ji" or "Pranshu sir".
alter table public.clients
  add column if not exists address_as text;
