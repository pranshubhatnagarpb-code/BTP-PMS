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
  
  // Get start date from AI plan data, database, or fall back to created_at (same logic as SavedDietPlans)
  const getStartDate = (plan: any) => {
    // First check if there's an edited start date in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableStartDate) {
      console.log(`Using editableStartDate: ${plan.ai_plan_data.editableStartDate}`);
      return new Date(plan.ai_plan_data.editableStartDate);
    }
    // Then check AI plan data startDate
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.startDate) {
      console.log(`Using AI plan startDate: ${plan.ai_plan_data.startDate}`);
      return new Date(plan.ai_plan_data.startDate);
    }
    // Then check if there's a start_date field in the database
    if (plan.start_date) {
      console.log(`Using database start_date: ${plan.start_date}`);
      return new Date(plan.start_date);
    }
    // Fall back to created_at
    console.log(`Using created_at as fallback: ${plan.created_at}`);
    return new Date(plan.created_at);
  };

  // Get plans with start_date for sorting (now all plans can be sorted since getStartDate handles all cases)
  const currentPlan = dietPlans
    .sort((a, b) => {
      // Use comprehensive getStartDate for both plans
      const dateA = getStartDate(a);
      const dateB = getStartDate(b);
      return dateB.getTime() - dateA.getTime();
    })[0];
  
  console.log('Current plan:', currentPlan ? {
    id: currentPlan.id,
    start_date: currentPlan.start_date,
    end_date: currentPlan.end_date,
    created_at: currentPlan.created_at,
    is_ai_generated: currentPlan.is_ai_generated,
    has_ai_plan_data: !!currentPlan.ai_plan_data,
    editableDayCount: currentPlan.ai_plan_data?.editableDayCount,
    has_dayGroups: !!currentPlan.ai_plan_data?.dayGroups,
    dayGroups_count: currentPlan.ai_plan_data?.dayGroups?.length || 0,
    diet_plan_days_count: currentPlan.diet_plan_days?.length || 0,
    status: currentPlan.status
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
    console.log(`getDayCount called for plan ${plan.id}:`, {
      is_ai_generated: plan.is_ai_generated,
      has_ai_plan_data: !!plan.ai_plan_data,
      editableDayCount: plan.ai_plan_data?.editableDayCount,
      diet_plan_days_count: plan.diet_plan_days?.length || 0,
      has_dayGroups: !!plan.ai_plan_data?.dayGroups
    });

    // First check if there's an edited day count in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableDayCount) {
      console.log(`Using editableDayCount: ${plan.ai_plan_data.editableDayCount}`);
      return parseInt(plan.ai_plan_data.editableDayCount);
    }
    
    // Then check diet_plan_days
    if (plan.diet_plan_days && plan.diet_plan_days.length > 0) {
      console.log(`Using diet_plan_days count: ${plan.diet_plan_days.length}`);
      return plan.diet_plan_days.length;
    }
    
    // Then check AI plan data dayGroups
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.dayGroups) {
      console.log(`Using dayGroups calculation with ${plan.ai_plan_data.dayGroups.length} groups`);
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
      
      console.log(`Calculated totalDays from dayGroups: ${totalDays}`);
      return totalDays;
    }
    
    console.log('No duration found, returning 0');
    return 0;
  };

  const actualPlanDuration = getDayCount(currentPlan) || 7; // Fallback to 7 if no days found
  console.log(`Calculated plan duration: ${actualPlanDuration} days for plan ${currentPlan.id}`);
  
  // If no end_date, calculate it from start date + actual plan duration using comprehensive getStartDate
  let endDate = currentPlan.end_date;
  if (!endDate) {
    const startDate = getStartDate(currentPlan);
    startDate.setDate(startDate.getDate() + actualPlanDuration - 1); // -1 because start_date counts as day 1
    endDate = startDate.toISOString().split('T')[0];
    console.log(`Calculated end_date: ${endDate} from comprehensive start date + ${actualPlanDuration} days`);
  }
  
  if (!endDate) {
    console.log(`No date info available for plan ${currentPlan.id}. Missing: end_date=${currentPlan.end_date}, start_date=${currentPlan.start_date}, created_at=${currentPlan.created_at}`);
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
  
  if (daysRemaining > 2) {
    color = 'green';
    display = `${daysRemaining} days left`;
  } else if (daysRemaining === 2) {
    color = 'yellow';
    display = '2 days left';
  } else if (daysRemaining === 1) {
    color = 'red';
    display = '1 day left';
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
