-- Add KYC fields for diet plan generation and billing
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS gender text,
ADD COLUMN IF NOT EXISTS skin_type text,
ADD COLUMN IF NOT EXISTS hair_type text,
ADD COLUMN IF NOT EXISTS goal text,
ADD COLUMN IF NOT EXISTS diet_preference text,
ADD COLUMN IF NOT EXISTS total_fees numeric DEFAULT 0;

-- Add comments for clarity
COMMENT ON COLUMN public.clients.gender IS 'Client gender: male, female, other';
COMMENT ON COLUMN public.clients.skin_type IS 'Skin type: oily, dry, combination, normal, sensitive';
COMMENT ON COLUMN public.clients.hair_type IS 'Hair type: oily, dry, normal, dandruff-prone, color-treated';
COMMENT ON COLUMN public.clients.goal IS 'Health goal: weight_loss, weight_gain, maintain, muscle_building';
COMMENT ON COLUMN public.clients.diet_preference IS 'Diet preference: vegetarian, non-vegetarian, vegan, eggetarian';
COMMENT ON COLUMN public.clients.total_fees IS 'Total fees charged to client';
COMMENT ON COLUMN public.clients.total_receivables IS 'Balance amount still owed by client';