-- Add client_code column if not exists
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_code text;

-- Generate client_code using a subquery with CTEs
WITH numbered_clients AS (
  SELECT id, ROW_NUMBER() OVER(ORDER BY created_at) as rn
  FROM clients
  WHERE client_code IS NULL OR client_code = ''
)
UPDATE clients
SET client_code = 'CL-' || LPAD(numbered_clients.rn::text, 4, '0')
FROM numbered_clients
WHERE clients.id = numbered_clients.id;