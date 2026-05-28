import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const usePauseEndingAlerts = () => {
  return useQuery({
    queryKey: ['dashboard', 'pause-ending'],
    queryFn: async () => {
      const today = new Date();
      const twoDaysLater = new Date(today);
      twoDaysLater.setDate(today.getDate() + 2);
      
      const todayStr = today.toISOString().split('T')[0];
      const twoDaysLaterStr = twoDaysLater.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, pause_end_date')
        .eq('is_active', true)
        .not('pause_end_date', 'is', null)
        .gte('pause_end_date', todayStr)
        .lte('pause_end_date', twoDaysLaterStr);
      
      if (error) throw error;
      return data || [];
    },
  });
};

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

export const useAtRiskClients = () => {
  return useQuery({
    queryKey: ['clients', 'at-risk'],
    queryFn: async () => {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          name,
          phone,
          pause_end_date,
          diet_plans (
            id,
            start_date,
            end_date,
            status,
            is_ai_generated,
            ai_plan_data,
            created_at,
            diet_plan_days (
              id
            )
          )
        `)
        .eq('is_active', true);

      if (clientsError) throw clientsError;

      const today0 = new Date();
      today0.setHours(0, 0, 0, 0);

      const atRiskClients = (clients || []).map((client: any) => {
        // Skip clients whose pause ends more than 2 days from now
        if (client.pause_end_date) {
          const pauseEnd = new Date(client.pause_end_date);
          pauseEnd.setHours(0, 0, 0, 0);
          const daysUntilPauseEnd = Math.ceil((pauseEnd.getTime() - today0.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntilPauseEnd > 2) return null;
        }

        const dietPlans = client.diet_plans || [];

        if (dietPlans.length === 0) {
          return null;
        }

        // Get start date from AI plan data, database, or fall back to created_at
        const getStartDate = (plan: any) => {
          if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableStartDate) {
            return new Date(plan.ai_plan_data.editableStartDate);
          }
          if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.startDate) {
            return new Date(plan.ai_plan_data.startDate);
          }
          if (plan.start_date) {
            return new Date(plan.start_date);
          }
          return new Date(plan.created_at);
        };

        // Get actual number of days from plan data
        const getDayCount = (plan: any) => {
          if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableDayCount) {
            return parseInt(plan.ai_plan_data.editableDayCount);
          }
          if (plan.diet_plan_days && plan.diet_plan_days.length > 0) {
            return plan.diet_plan_days.length;
          }
          if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.dayGroups) {
            let totalDays = 0;
            plan.ai_plan_data.dayGroups.forEach((group: any) => {
              if (group.label) {
                const daysInLabel = group.label.split(/ & |, | &/).length;
                totalDays += daysInLabel;
              } else {
                totalDays += 1;
              }
            });
            return totalDays;
          }
          return 0;
        };

        // Get the most recent plan
        const currentPlan = dietPlans
          .sort((a: any, b: any) => {
            const dateA = getStartDate(a);
            const dateB = getStartDate(b);
            return dateB.getTime() - dateA.getTime();
          })[0];

        if (!currentPlan) {
          return null;
        }

        const actualPlanDuration = getDayCount(currentPlan) || 7;
        
        // Calculate end date
        let endDate = currentPlan.end_date;
        if (!endDate) {
          const startDate = getStartDate(currentPlan);
          startDate.setDate(startDate.getDate() + actualPlanDuration - 1);
          endDate = startDate.toISOString().split('T')[0];
        }

        if (!endDate) {
          return null;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const finalEndDate = new Date(endDate);
        finalEndDate.setHours(0, 0, 0, 0);
        
        const timeDiff = finalEndDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        let color: 'green' | 'yellow' | 'red' | 'black';
        
        if (daysRemaining > 2) {
          color = 'green';
        } else if (daysRemaining === 2) {
          color = 'yellow';
        } else if (daysRemaining === 1) {
          color = 'red';
        } else {
          color = 'black';
        }

        // Only include clients with yellow or red status
        if (color === 'yellow' || color === 'red') {
          return {
            id: client.id,
            name: client.name,
            phone: client.phone,
            daysRemaining,
            color,
            display: color === 'yellow' ? '2 days left' : '1 day left'
          };
        }

        return null;
      }).filter(Boolean);

      return atRiskClients;
    },
  });
};

