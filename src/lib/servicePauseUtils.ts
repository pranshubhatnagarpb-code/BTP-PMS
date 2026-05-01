import { Client } from '@/hooks/useClients';

export interface ServiceRenewalInfo {
  baseEndDate: Date | null;
  effectiveEndDate: Date | null;
  pausedDays: number;
  isPaused: boolean;
  pauseDaysRemaining: number;
}

/**
 * Compute the effective service renewal date taking into account:
 *  - service_start_date + service_duration_months (base end date)
 *  - service_paused_days (already-accumulated pauses)
 *  - active pause window (pause_start_date / pause_end_date)
 */
export function getServiceRenewalInfo(client: Pick<Client,
  'service_start_date' | 'service_duration_months' | 'service_paused_days' | 'pause_start_date' | 'pause_end_date'
>): ServiceRenewalInfo {
  const pausedDays = client.service_paused_days ?? 0;
  let baseEndDate: Date | null = null;

  if (client.service_start_date && client.service_duration_months) {
    const d = new Date(client.service_start_date);
    d.setMonth(d.getMonth() + client.service_duration_months);
    baseEndDate = d;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let pauseDaysRemaining = 0;
  let isPaused = false;
  if (client.pause_start_date && client.pause_end_date) {
    const ps = new Date(client.pause_start_date);
    const pe = new Date(client.pause_end_date);
    ps.setHours(0, 0, 0, 0);
    pe.setHours(0, 0, 0, 0);
    if (today >= ps && today <= pe) {
      isPaused = true;
      pauseDaysRemaining = Math.ceil((pe.getTime() - today.getTime()) / 86400000) + 1;
    }
  }

  let effectiveEndDate: Date | null = null;
  if (baseEndDate) {
    const e = new Date(baseEndDate);
    e.setDate(e.getDate() + pausedDays + pauseDaysRemaining);
    effectiveEndDate = e;
  }

  return { baseEndDate, effectiveEndDate, pausedDays, isPaused, pauseDaysRemaining };
}

export function formatDate(d: Date | null): string {
  if (!d) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
