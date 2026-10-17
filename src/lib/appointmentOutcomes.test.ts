import { describe, it, expect } from 'vitest';
import { dietFollowupDueAt, isOnlineMode, STATUS_FOR_OUTCOME } from './appointmentOutcomes';

describe('dietFollowupDueAt', () => {
  const recorded = new Date('2026-09-26T10:00:00Z');

  it('is 48 hours after a held online or physical + online meeting', () => {
    expect(dietFollowupDueAt('online', 'held', recorded)).toEqual(new Date('2026-09-28T10:00:00Z'));
    expect(dietFollowupDueAt('physical_online', 'held', recorded)).toEqual(new Date('2026-09-28T10:00:00Z'));
  });

  it('is not needed for physical meetings', () => {
    expect(dietFollowupDueAt('physical', 'held', recorded)).toBeNull();
  });

  it('is not needed when the meeting did not happen', () => {
    expect(dietFollowupDueAt('online', 'no_show', recorded)).toBeNull();
    expect(dietFollowupDueAt('online', 'cancelled', recorded)).toBeNull();
    expect(dietFollowupDueAt('online', 'other', recorded)).toBeNull();
  });
});

describe('outcome mapping', () => {
  it('maps outcomes to appointment status', () => {
    expect(STATUS_FOR_OUTCOME.held).toBe('completed');
    expect(STATUS_FOR_OUTCOME.no_show).toBe('no_show');
    expect(STATUS_FOR_OUTCOME.cancelled).toBe('cancelled');
  });

  it('treats only online modes as needing a meeting link', () => {
    expect(['physical', 'online', 'physical_online'].map(isOnlineMode)).toEqual([false, true, true]);
  });
});
