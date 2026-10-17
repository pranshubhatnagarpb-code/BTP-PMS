// Meeting modes, appointment outcomes, and the diet plan follow-up rule.

export type MeetingMode = 'physical' | 'online' | 'physical_online';
// Matches the appointments_clinic_location_check constraint and clinic.addresses keys.
export type ClinicLocation = 'mulund_east' | 'mulund_west';
export type AppointmentOutcome = 'held' | 'no_show' | 'cancelled' | 'other';

// Display names for appointment types. The stored value stays 'consultation' so
// existing appointments keep working; only the label is "First Counselling".
// Keep in sync with APPOINTMENT_TYPE_LABELS in api/_lib/zohoClient.js.
export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consultation: 'First Counselling',
  follow_up: 'Follow Up',
  prospect_call: 'Prospect Call',
  diet_review: 'Diet Review',
  checkup: 'Checkup',
};

// Types offered when creating an appointment. diet_review / checkup stay in the
// label map above so older appointments still display correctly.
export const SELECTABLE_APPOINTMENT_TYPES = ['consultation', 'follow_up', 'prospect_call'] as const;

// Appointment length in minutes; the Zoho Calendar event blocks this long.
// Defaults follow the call lengths in the WhatsApp templates (40 / 20 min).
// A full day spans the clinic's working hours (10:00–19:00).
export const FULL_DAY_DURATION = 540;
export const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60, 75, 90, 120, 240, 360, 480, FULL_DAY_DURATION] as const;
export const DEFAULT_DURATION_BY_TYPE: Record<string, number> = { consultation: 40, follow_up: 20 };
export const DEFAULT_DURATION = 30;

// Time blocked off every day, indefinitely; shown on the calendar and warned
// about when a booking overlaps. Times are minutes from midnight (IST).
export interface RecurringBlock { label: string; start: number; end: number }
export const RECURRING_BLOCKS: RecurringBlock[] = [
  { label: 'Lunch + BTP work', start: 13 * 60 + 30, end: 14 * 60 + 30 },
  { label: 'Blocked', start: 16 * 60 + 30, end: 17 * 60 + 30 },
  { label: 'Blocked', start: 21 * 60, end: 21 * 60 + 30 },
];

export const overlappingBlocks = (start: number, duration: number) =>
  RECURRING_BLOCKS.filter((b) => start < b.end && start + duration > b.start);

export const formatDuration = (minutes: number) => {
  if (minutes === FULL_DAY_DURATION) return 'Full day';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
};

export const MEETING_MODE_LABELS: Record<MeetingMode, string> = {
  physical: 'Physical',
  online: 'Online',
  physical_online: 'Physical + Online',
};

export const OUTCOME_LABELS: Record<AppointmentOutcome, string> = {
  held: 'Held',
  no_show: 'Client no-show',
  cancelled: 'Cancelled',
  other: 'Other',
};

// Online meetings get a Zoho Meeting link; physical ones are in person.
export const isOnlineMode = (mode: string) => mode === 'online' || mode === 'physical_online';

// Physical and physical + online appointments happen at one of the clinics.
export const needsClinicLocation = (mode: string) => mode === 'physical' || mode === 'physical_online';

// The appointment's lifecycle status for each outcome.
export const STATUS_FOR_OUTCOME: Record<AppointmentOutcome, string> = {
  held: 'completed',
  other: 'completed',
  no_show: 'no_show',
  cancelled: 'cancelled',
};

export const DIET_FOLLOWUP_DELAY_HOURS = 48;

// A diet plan follow-up is due 48h after a held online / physical+online meeting.
// Physical-only meetings need no reminder.
export const dietFollowupDueAt = (mode: string, outcome: AppointmentOutcome, recordedAt: Date): Date | null => {
  if (outcome !== 'held' || !isOnlineMode(mode)) return null;
  return new Date(recordedAt.getTime() + DIET_FOLLOWUP_DELAY_HOURS * 60 * 60 * 1000);
};
