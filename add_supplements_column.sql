-- Add supplements column to clients table
ALTER TABLE clients ADD COLUMN supplements TEXT;

-- Add comment
COMMENT ON COLUMN clients.supplements IS 'Suggested supplements for the client with dosage instructions';
