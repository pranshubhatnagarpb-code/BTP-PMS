-- AI analysis of a blood report. Generated on demand from the report's values
-- by the `analyze-blood-report` edge function and reviewed by the nutritionist.
-- The diet plan generator can optionally feed this summary into plan generation.
alter table public.blood_reports
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_analysis_generated_at timestamptz;
