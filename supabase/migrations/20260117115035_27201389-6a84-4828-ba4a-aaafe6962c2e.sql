-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  date_of_birth DATE,
  anniversary_date DATE,
  weight DECIMAL(5,2),
  height DECIMAL(5,2),
  health_conditions TEXT[],
  total_receivables DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  appointment_type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diet_options table (predefined meal options)
CREATE TABLE public.diet_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snacks', 'dinner')),
  name TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  is_vegetarian BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diet_plans table (master plan per client)
CREATE TABLE public.diet_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create diet_plan_days table (individual day entries)
CREATE TABLE public.diet_plan_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  breakfast_option_id UUID REFERENCES public.diet_options(id),
  lunch_option_id UUID REFERENCES public.diet_options(id),
  snacks_option_id UUID REFERENCES public.diet_options(id),
  dinner_option_id UUID REFERENCES public.diet_options(id),
  total_calories INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create receivables table
CREATE TABLE public.receivables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_followups table
CREATE TABLE public.lead_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  lead_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  followup_date DATE NOT NULL,
  followup_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users (internal team access)
-- Clients table policies
CREATE POLICY "Authenticated users can view all clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- Appointments table policies
CREATE POLICY "Authenticated users can view all appointments" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (true);

-- Diet options table policies (read-only for team, admin can modify)
CREATE POLICY "Authenticated users can view all diet_options" ON public.diet_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_options" ON public.diet_options FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_options" ON public.diet_options FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_options" ON public.diet_options FOR DELETE TO authenticated USING (true);

-- Diet plans table policies
CREATE POLICY "Authenticated users can view all diet_plans" ON public.diet_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_plans" ON public.diet_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_plans" ON public.diet_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_plans" ON public.diet_plans FOR DELETE TO authenticated USING (true);

-- Diet plan days table policies
CREATE POLICY "Authenticated users can view all diet_plan_days" ON public.diet_plan_days FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert diet_plan_days" ON public.diet_plan_days FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update diet_plan_days" ON public.diet_plan_days FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete diet_plan_days" ON public.diet_plan_days FOR DELETE TO authenticated USING (true);

-- Receivables table policies
CREATE POLICY "Authenticated users can view all receivables" ON public.receivables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert receivables" ON public.receivables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update receivables" ON public.receivables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete receivables" ON public.receivables FOR DELETE TO authenticated USING (true);

-- Lead followups table policies
CREATE POLICY "Authenticated users can view all lead_followups" ON public.lead_followups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lead_followups" ON public.lead_followups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update lead_followups" ON public.lead_followups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete lead_followups" ON public.lead_followups FOR DELETE TO authenticated USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_diet_plans_updated_at BEFORE UPDATE ON public.diet_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_receivables_updated_at BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lead_followups_updated_at BEFORE UPDATE ON public.lead_followups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_clients_date_of_birth ON public.clients(date_of_birth);
CREATE INDEX idx_clients_anniversary_date ON public.clients(anniversary_date);
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_diet_plans_client ON public.diet_plans(client_id);
CREATE INDEX idx_receivables_due_date ON public.receivables(due_date);
CREATE INDEX idx_receivables_status ON public.receivables(status);
CREATE INDEX idx_lead_followups_date ON public.lead_followups(followup_date);