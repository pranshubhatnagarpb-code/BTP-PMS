import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, CalendarClock } from 'lucide-react';
import { Client, useUpdateClient, useClients } from '@/hooks/useClients';
import { getServiceRenewalInfo, formatDate } from '@/lib/servicePauseUtils';
import { toast } from 'sonner';

interface Props {
  client: Client;
  /** Optional live overrides from the edit form (unsaved values) so the
   *  renewal preview updates immediately as the user changes them. */
  serviceStartDateOverride?: string | null;
  serviceDurationMonthsOverride?: number | null;
}

export const ServicePauseSection = ({
  client,
  serviceStartDateOverride,
  serviceDurationMonthsOverride,
}: Props) => {
  const updateClient = useUpdateClient();
  // Read latest client snapshot from the cache so changes after pause/resume
  // mutations are reflected immediately even if the parent component still
  // holds the stale `client` prop.
  const { data: allClients } = useClients();
  const latest = allClients?.find((c) => c.id === client.id) ?? client;

  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Build a "live" client view that prefers unsaved form values for the
  // start date and duration so the computed renewal date reflects edits in
  // real time, before the user clicks save.
  const liveClient = useMemo(() => ({
    ...latest,
    service_start_date:
      serviceStartDateOverride !== undefined
        ? serviceStartDateOverride
        : latest.service_start_date,
    service_duration_months:
      serviceDurationMonthsOverride !== undefined
        ? serviceDurationMonthsOverride
        : latest.service_duration_months,
  }), [latest, serviceStartDateOverride, serviceDurationMonthsOverride]);

  const info = useMemo(() => getServiceRenewalInfo(liveClient), [liveClient]);

  // Live preview of additional days the user is about to pause for (before
  // they click "Pause Service").
  const previewDays = parseInt(duration);
  const hasPreview = !liveClient.pause_start_date && Number.isFinite(previewDays) && previewDays > 0;
  const previewedRenewal = useMemo(() => {
    if (!hasPreview || !info.effectiveEndDate) return null;
    const d = new Date(info.effectiveEndDate);
    d.setDate(d.getDate() + previewDays);
    return d;
  }, [hasPreview, info.effectiveEndDate, previewDays]);

  const handleStartPause = async () => {
    const days = parseInt(duration);
    if (!days || days <= 0) {
      toast.error('Enter a valid pause duration in days');
      return;
    }
    if (!startDate) {
      toast.error('Select a pause start date');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    try {
      await updateClient.mutateAsync({
        id: latest.id,
        pause_start_date: startDate,
        pause_end_date: end.toISOString().split('T')[0],
      } as any);
      toast.success(`Service paused for ${days} day${days === 1 ? '' : 's'}. Renewal date extended automatically.`);
      setDuration('');
    } catch (e) {
      // handled in hook
    }
  };

  const handleEndPauseEarly = async () => {
    if (!latest.pause_start_date) return;
    // Days actually paused = max(0, min(today, pause_end) - pause_start + 1)
    const ps = new Date(latest.pause_start_date);
    ps.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let effectiveEndForCount = today;
    if (latest.pause_end_date) {
      const pe = new Date(latest.pause_end_date);
      pe.setHours(0, 0, 0, 0);
      if (pe < today) effectiveEndForCount = pe;
    }

    let daysPausedSoFar = Math.floor((effectiveEndForCount.getTime() - ps.getTime()) / 86400000) + 1;
    if (daysPausedSoFar < 0) daysPausedSoFar = 0;

    try {
      await updateClient.mutateAsync({
        id: latest.id,
        service_paused_days: (latest.service_paused_days ?? 0) + daysPausedSoFar,
        pause_start_date: null,
        pause_end_date: null,
      } as any);
      toast.success(
        daysPausedSoFar > 0
          ? `Pause ended. ${daysPausedSoFar} day${daysPausedSoFar === 1 ? '' : 's'} added to renewal date.`
          : 'Pause cancelled. No days were added.'
      );
    } catch (e) {
      // handled in hook
    }
  };

  const handleCommitCompletedPause = async () => {
    if (!latest.pause_start_date || !latest.pause_end_date) return;
    const ps = new Date(latest.pause_start_date);
    const pe = new Date(latest.pause_end_date);
    const totalDays = Math.floor((pe.getTime() - ps.getTime()) / 86400000) + 1;
    try {
      await updateClient.mutateAsync({
        id: latest.id,
        service_paused_days: (latest.service_paused_days ?? 0) + totalDays,
        pause_start_date: null,
        pause_end_date: null,
      } as any);
      toast.success('Completed pause recorded.');
    } catch (e) {
      // handled in hook
    }
  };

  // Auto-detect if scheduled pause has finished
  const todayStr = new Date().toISOString().split('T')[0];
  const pauseFinished = latest.pause_end_date
    ? new Date(latest.pause_end_date) < new Date(todayStr)
    : false;

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-primary flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          Service Pause
        </h3>
        {info.isPaused && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
            Currently Paused • {info.pauseDaysRemaining} day{info.pauseDaysRemaining === 1 ? '' : 's'} left
          </Badge>
        )}
      </div>

      {/* Renewal summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Original Renewal</div>
          <div className="font-medium">{formatDate(info.baseEndDate)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Total Paused Days</div>
          <div className="font-medium">
            {info.pausedDays + info.pauseDaysRemaining}
            {hasPreview && (
              <span className="text-muted-foreground"> (+{previewDays} preview)</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">New Renewal Date</div>
          <div className="font-semibold text-primary">
            {formatDate(hasPreview ? previewedRenewal : info.effectiveEndDate)}
          </div>
        </div>
      </div>

      {/* Active pause / completed pause actions */}
      {latest.pause_start_date && latest.pause_end_date && (
        <div className="rounded-md bg-background/60 p-3 text-sm space-y-2">
          <div>
            Pause window: <span className="font-medium">{formatDate(new Date(latest.pause_start_date))}</span> →{' '}
            <span className="font-medium">{formatDate(new Date(latest.pause_end_date))}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pauseFinished && (
              <Button
                type="button"
                size="sm"
                onClick={handleCommitCompletedPause}
                disabled={updateClient.isPending}
              >
                <Play className="h-4 w-4 mr-2" /> Resume Service & Apply Extension
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleEndPauseEarly}
              disabled={updateClient.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {pauseFinished ? 'Cancel Pause' : 'End Pause Early'}
            </Button>
          </div>
        </div>
      )}

      {/* Start a new pause */}
      {!latest.pause_start_date && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="pause_start">Pause Start Date</Label>
            <Input
              id="pause_start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pause_duration">Duration (days)</Label>
            <Input
              id="pause_duration"
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g., 7"
            />
          </div>
          <Button
            type="button"
            onClick={handleStartPause}
            disabled={updateClient.isPending}
            className="bg-primary text-primary-foreground"
          >
            <Pause className="h-4 w-4 mr-2" /> Pause Service
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Pausing the service automatically extends the renewal date by the same number of days.
      </p>
    </div>
  );
};
