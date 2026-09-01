ALTER TABLE clients
  ALTER COLUMN service_duration_months TYPE numeric USING service_duration_months::numeric;
