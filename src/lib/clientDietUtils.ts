import { Client, ClientWithDietData } from '@/hooks/useClients';

export interface DietProgressInfo {
  completed: number;
  total: number | null;
  display: string;
}

export interface ExpiryStatusInfo {
  color: 'green' | 'yellow' | 'red' | 'black' | 'grey';
  daysRemaining: number | null;
  display: string;
}

// Calculate diet chart progress
export const calculateDietProgress = (client: ClientWithDietData): DietProgressInfo => {
  const total = client.number_of_diet_charts;
  const completed = client.diet_plans.filter(plan => plan.status === 'approved').length;
  
  if (total === null || total === 0) {
    return {
      completed,
      total: null,
      display: '-'
    };
  }
  
  return {
    completed,
      total,
    display: `${completed}/${total}`
  };
};

// Calculate expiry status
export const calculateExpiryStatus = (client: ClientWithDietData): ExpiryStatusInfo => {
  const dietPlans = client.diet_plans;
  
  // Debug logging
  console.log(`Client: ${client.name}, Diet plans count: ${dietPlans.length}`);
  if (dietPlans.length > 0) {
    console.log('Diet plans:', dietPlans.map(p => ({ 
      id: p.id, 
      status: p.status, 
      start_date: p.start_date, 
      end_date: p.end_date 
    })));
  }
  
  if (dietPlans.length === 0) {
    return {
      color: 'grey',
      daysRemaining: null,
      display: 'No diet plan'
    };
  }
  
  // Get plans with start_date for sorting
  const plansWithDate = dietPlans.filter(plan => plan.start_date);
  console.log(`Plans with start_date: ${plansWithDate.length}`);
  
  // If no plans have start_date, use created_at as fallback
  const plansToUse = plansWithDate.length > 0 ? plansWithDate : dietPlans;
  
  // Sort by latest start_date (not created_at) to get the most recent plan
  const currentPlan = plansToUse
    .sort((a, b) => {
      // Prefer start_date over created_at for sorting
      const dateA = new Date(a.start_date || a.created_at);
      const dateB = new Date(b.start_date || b.created_at);
      return dateB.getTime() - dateA.getTime();
    })[0];
  
  console.log('Current plan:', currentPlan ? {
    id: currentPlan.id,
    start_date: currentPlan.start_date,
    end_date: currentPlan.end_date,
    created_at: currentPlan.created_at,
    days_count: currentPlan.diet_plan_days?.length || 0
  } : 'No current plan found');
  
  if (!currentPlan) {
    return {
      color: 'grey',
      daysRemaining: null,
      display: 'No valid diet plan'
    };
  }
  
  // Get actual number of days from plan data (same logic as SavedDietPlans)
  const getDayCount = (plan: any) => {
    // First check if there's an edited day count in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableDayCount) {
      return parseInt(plan.ai_plan_data.editableDayCount);
    }
    
    // Then check diet_plan_days
    if (plan.diet_plan_days && plan.diet_plan_days.length > 0) {
      return plan.diet_plan_days.length;
    }
    
    // Then check AI plan data dayGroups
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.dayGroups) {
      // Count actual days from dayGroups labels
      // Labels like "Monday & Thursday" contain 2 days, "Wednesday" contains 1 day, etc.
      let totalDays = 0;
      
      plan.ai_plan_data.dayGroups.forEach((group: any) => {
        if (group.label) {
          // Count days in the label (split by " & ", " & ", ", ")
          const daysInLabel = group.label.split(/ & |, | &/).length;
          totalDays += daysInLabel;
        } else {
          totalDays += 1; // Default to 1 if no label
        }
      });
      
      return totalDays;
    }
    
    return 0;
  };

  const actualPlanDuration = getDayCount(currentPlan) || 7; // Fallback to 7 if no days found
  console.log(`Calculated plan duration: ${actualPlanDuration} days for plan ${currentPlan.id}`);
  
  // If no end_date, calculate it from start_date + actual plan duration
  let endDate = currentPlan.end_date;
  if (!endDate && currentPlan.start_date) {
    const startDate = new Date(currentPlan.start_date);
    startDate.setDate(startDate.getDate() + actualPlanDuration - 1); // -1 because start_date counts as day 1
    endDate = startDate.toISOString().split('T')[0];
    console.log(`Calculated end_date: ${endDate} from start_date: ${currentPlan.start_date} + ${actualPlanDuration} days`);
  }
  
  if (!endDate) {
    return {
      color: 'grey',
      daysRemaining: null,
      display: 'No date info'
    };
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
  
  const finalEndDate = new Date(endDate);
  finalEndDate.setHours(0, 0, 0, 0);
  
  const timeDiff = finalEndDate.getTime() - today.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  let color: 'green' | 'yellow' | 'red' | 'black';
  let display: string;
  
  if (daysRemaining >= 4) {
    color = 'green';
    display = `${daysRemaining} days left`;
  } else if (daysRemaining === 3) {
    color = 'yellow';
    display = '3 days left';
  } else if (daysRemaining === 2 || daysRemaining === 1) {
    color = 'red';
    display = `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
  } else {
    color = 'black';
    display = daysRemaining < 0 ? `Expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago` : 'Expires today';
  }
  
  return {
    color,
    daysRemaining,
    display
  };
};

// Get color classes for expiry status dots
export const getExpiryColorClasses = (color: ExpiryStatusInfo['color']) => {
  switch (color) {
    case 'green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'red':
      return 'bg-red-500';
    case 'black':
      return 'bg-black';
    case 'grey':
      return 'bg-gray-400';
    default:
      return 'bg-gray-400';
  }
};
