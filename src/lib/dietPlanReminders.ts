// Diet plan follow-up reminders: milestones on day 5 and day 10 of a client's
// latest approved plan, then every 10th day (20, 30, 40, …) until a newer plan is
// approved. A reminder stays visible from its milestone day until staff mark it
// done, and comes back at the next milestone.

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Parses "YYYY-MM-DD" (or an ISO timestamp) as a local calendar date, so the
// day count doesn't shift by a day in timezones ahead of UTC.
export const toLocalDate = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

// Day 1 is the plan's start date.
export const planDayNumber = (startDate: Date, today: Date): number => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day.getTime() - start.getTime()) / MS_PER_DAY) + 1;
};

// The latest milestone reached by this day of the plan, or null before day 5.
export const currentReminderMilestone = (dayNumber: number): number | null => {
  if (dayNumber < 5) return null;
  if (dayNumber < 10) return 5;
  return Math.floor(dayNumber / 10) * 10;
};

// Whether a reminder is showing, given the last milestone marked done on the plan.
export const isReminderDue = (dayNumber: number, doneThroughMilestone: number | null): boolean => {
  const milestone = currentReminderMilestone(dayNumber);
  return milestone !== null && milestone > (doneThroughMilestone ?? 0);
};

export interface PlanStartSource {
  start_date: string | null;
  created_at: string;
  is_ai_generated: boolean | null;
  editable_start_date?: string | null;
  ai_start_date?: string | null;
}

// Same precedence the rest of the app uses: the start date edited on the AI
// plan, then the AI plan's start date, then the column, then creation date.
export const getPlanStartDate = (plan: PlanStartSource): Date | null => {
  const candidates = plan.is_ai_generated
    ? [plan.editable_start_date, plan.ai_start_date, plan.start_date, plan.created_at]
    : [plan.start_date, plan.created_at];
  for (const c of candidates) {
    const d = c ? toLocalDate(c) : null;
    if (d) return d;
  }
  return null;
};
