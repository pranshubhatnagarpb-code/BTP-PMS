import { describe, it, expect } from 'vitest';
import { currentReminderMilestone, getPlanStartDate, isReminderDue, planDayNumber, toLocalDate } from './dietPlanReminders';

describe('currentReminderMilestone', () => {
  it('starts on day 5, then day 10 and every 10th day after', () => {
    expect([1, 4, 5, 9, 10, 19, 20, 29, 30, 47].map(currentReminderMilestone))
      .toEqual([null, null, 5, 5, 10, 10, 20, 20, 30, 40]);
  });
});

describe('isReminderDue', () => {
  it('stays due after the milestone day until marked done', () => {
    expect(isReminderDue(7, null)).toBe(true);
    expect(isReminderDue(7, 5)).toBe(false);
  });

  it('comes back at the next milestone after being marked done', () => {
    expect(isReminderDue(9, 5)).toBe(false);
    expect(isReminderDue(10, 5)).toBe(true);
    expect(isReminderDue(25, 10)).toBe(true);
    expect(isReminderDue(25, 20)).toBe(false);
  });

  it('is never due before day 5', () => {
    expect(isReminderDue(4, null)).toBe(false);
  });
});

describe('planDayNumber', () => {
  it('counts the start date as day 1', () => {
    const start = new Date(2026, 8, 1);
    expect(planDayNumber(start, new Date(2026, 8, 1))).toBe(1);
    expect(planDayNumber(start, new Date(2026, 8, 5, 23, 30))).toBe(5);
    expect(planDayNumber(start, new Date(2026, 9, 1))).toBe(31);
  });

  it('is zero or negative for plans starting in the future', () => {
    expect(planDayNumber(new Date(2026, 8, 10), new Date(2026, 8, 9))).toBe(0);
  });
});

describe('getPlanStartDate', () => {
  const base = { start_date: '2026-09-03', created_at: '2026-09-01T10:00:00Z' };

  it('prefers the edited start date on AI plans', () => {
    const d = getPlanStartDate({ ...base, is_ai_generated: true, editable_start_date: '2026-09-07', ai_start_date: '2026-09-05' });
    expect(d).toEqual(new Date(2026, 8, 7));
  });

  it('falls back to the start_date column, then created_at', () => {
    expect(getPlanStartDate({ ...base, is_ai_generated: false })).toEqual(new Date(2026, 8, 3));
    expect(getPlanStartDate({ ...base, start_date: null, is_ai_generated: false })).toEqual(new Date(2026, 8, 1));
  });

  it('ignores unparseable values', () => {
    expect(toLocalDate('not a date')).toBeNull();
    expect(getPlanStartDate({ ...base, is_ai_generated: true, editable_start_date: '' })).toEqual(new Date(2026, 8, 3));
  });
});
