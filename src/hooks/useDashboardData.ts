import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const { count: activeClients, error: clientsError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (clientsError) throw clientsError;

      // Count clients added this month with total_fees > 0
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: serviceSales, error: salesError } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', firstOfMonth)
        .gt('total_fees', 0);

      if (salesError) throw salesError;

      return {
        totalActiveClients: activeClients || 0,
        serviceSalesThisMonth: serviceSales || 0,
      };
    },
  });
};

export const useTodaysAppointments = () => {
  return useQuery({
    queryKey: ['appointments', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_time,
          appointment_type,
          status,
          clients (
            id,
            name
          )
        `)
        .eq('appointment_date', today)
        .order('appointment_time');
      
      if (error) throw error;
      return data || [];
    },
  });
};

export const useTodaysFollowups = () => {
  return useQuery({
    queryKey: ['followups', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('lead_followups')
        .select('*')
        .eq('followup_date', today)
        .eq('status', 'pending')
        .order('followup_time');
      
      if (error) throw error;
      return data || [];
    },
  });
};

export const useUpcomingReceivables = () => {
  return useQuery({
    queryKey: ['receivables', 'upcoming'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('receivables')
        .select(`
          id,
          service_name,
          amount,
          due_date,
          status,
          clients (
            id,
            name,
            phone
          )
        `)
        .gte('due_date', today)
        .neq('status', 'paid')
        .order('due_date')
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });
};

export const useServiceRenewalReminders = () => {
  return useQuery({
    queryKey: ['clients', 'service-renewals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, service_start_date, service_duration_months, service_paused_days')
        .not('service_start_date', 'is', null)
        .not('service_duration_months', 'is', null)
        .eq('is_active', true);

      if (error) throw error;

      const now = new Date();
      const reminders = (data || [])
        .map((client: any) => {
          const start = new Date(client.service_start_date);
          const end = new Date(start);
          end.setMonth(end.getMonth() + client.service_duration_months);
          const pausedDays = Number(client.service_paused_days) || 0;
          if (pausedDays > 0) {
            end.setDate(end.getDate() + pausedDays);
          }
          const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { ...client, service_end_date: end.toISOString().split('T')[0], days_left: daysLeft };
        })
        .filter((c: any) => c.days_left <= 7 && c.days_left >= -30)
        .sort((a: any, b: any) => a.days_left - b.days_left);

      return reminders;
    },
  });
};

export const useBalanceReceivables = () => {
  return useQuery({
    queryKey: ['clients', 'balance-receivables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, total_fees, total_receivables')
        .gt('total_receivables', 0)
        .eq('is_active', true)
        .order('total_receivables', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
};

