import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { InfoCard } from '@/components/dashboard/InfoCard';
import { DataTable } from '@/components/dashboard/DataTable';
import {
  useDashboardStats,
  useTodaysAppointments,
  useUpcomingReceivables,
  useBalanceReceivables,
  useServiceRenewalReminders,
  useAtRiskClients,
  usePausedClients,
  useDietPlanReminders,
  useSetDietPlanReminderDone,
  type DietPlanReminder,
} from '@/hooks/useDashboardData';
import { useTodaysBirthdays } from '@/hooks/useClients';
import { useZohoSync } from '@/hooks/useZohoCalendar';
import { Home, ChevronRight, Plus, Check, Video } from 'lucide-react';
import { toast } from 'sonner';
import { CreateAppointmentDialog } from '@/components/appointments/CreateAppointmentDialog';
import { RecordOutcomeDialog } from '@/components/appointments/RecordOutcomeDialog';
import { RescheduleDialog } from '@/components/appointments/RescheduleDialog';
import { DietFollowupActions } from '@/components/dashboard/DietFollowupActions';
import { Appointment, DietFollowup, useAppointmentsAwaitingOutcome, useDueDietFollowups } from '@/hooks/useAppointments';
import { MEETING_MODE_LABELS } from '@/lib/appointmentOutcomes';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { StatusDot } from '@/components/ui/StatusDot';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemo, useState } from 'react';

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: appointments = [] } = useTodaysAppointments();
  const { data: birthdays = [] } = useTodaysBirthdays();
  const { data: balanceReceivables = [] } = useBalanceReceivables();
  const { data: serviceRenewals = [] } = useServiceRenewalReminders();
  const { data: atRiskClients = [] } = useAtRiskClients();
  const { data: pausedClients = [] } = usePausedClients();
  const { data: dietPlanReminders = [] } = useDietPlanReminders();
  useZohoSync();
  // 'all', 'overdue' (day 20 onwards), or a specific milestone day like '5', '10', '30'.
  const [reminderFilter, setReminderFilter] = useState('all');
  const reminderFilterOptions = useMemo(() => {
    const countFor = (match: (m: number) => boolean) => dietPlanReminders.filter((r) => match(r.milestone)).length;
    const later = [...new Set(dietPlanReminders.map((r) => r.milestone).filter((m) => m >= 20))].sort((a, b) => a - b);
    return [
      { value: 'all', label: 'All reminders', count: dietPlanReminders.length },
      { value: '5', label: 'Day 5 · Check-in', count: countFor((m) => m === 5) },
      { value: '10', label: 'Day 10 · New plan due', count: countFor((m) => m === 10) },
      { value: 'overdue', label: 'Day 20+ · No new plan', count: countFor((m) => m >= 20) },
      ...later.map((m) => ({ value: String(m), label: `Day ${m}`, count: countFor((x) => x === m) })),
    ];
  }, [dietPlanReminders]);
  // A specific later milestone drops out of the options once its last reminder is
  // marked done; fall back to showing everything rather than a blank selection.
  const activeReminderFilter = reminderFilterOptions.some((o) => o.value === reminderFilter) ? reminderFilter : 'all';
  const filteredDietPlanReminders = dietPlanReminders.filter((r) =>
    activeReminderFilter === 'all' ? true
      : activeReminderFilter === 'overdue' ? r.milestone >= 20
      : r.milestone === Number(activeReminderFilter));
  const setReminderDone = useSetDietPlanReminderDone();
  const { data: appointmentsAwaitingOutcome = [] } = useAppointmentsAwaitingOutcome();
  const { data: dietFollowups = [] } = useDueDietFollowups();

  const appointmentReminderColumns = [
    {
      key: 'when',
      header: 'When',
      render: (item: Appointment) => {
        const daysAgo = differenceInCalendarDays(new Date(), parseISO(item.appointment_date));
        return (
          <div>
            <div className="font-medium">{item.appointment_time?.slice(0, 5)}</div>
            <div className={daysAgo > 0 ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
              {daysAgo === 0 ? 'Today' : `${format(parseISO(item.appointment_date), 'dd MMM')} · not closed`}
            </div>
          </div>
        );
      },
    },
    {
      key: 'client',
      header: 'Client',
      render: (item: Appointment) => <span className="text-primary font-medium">{item.clients?.name || '-'}</span>,
    },
    {
      key: 'mode',
      header: 'Mode',
      render: (item: Appointment) => (
        <div className="flex flex-col gap-0.5">
          <span className="whitespace-nowrap">{MEETING_MODE_LABELS[item.meeting_mode] ?? item.meeting_mode}</span>
          {item.meet_link && (
            <a href={item.meet_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <Video className="h-3 w-3" /> Join
            </a>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (item: Appointment) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          <RescheduleDialog appointmentId={item.id} currentDate={item.appointment_date} currentTime={item.appointment_time} />
          <RecordOutcomeDialog appointment={item} />
        </div>
      ),
    },
  ];

  const dietFollowupColumns = [
    {
      key: 'client',
      header: 'Client',
      render: (item: DietFollowup) => <span className="text-primary font-medium">{item.clients.name}</span>,
    },
    {
      key: 'meeting',
      header: 'Meeting',
      render: (item: DietFollowup) => (
        <div>
          <div>{format(parseISO(item.appointment_date), 'dd MMM')}</div>
          <div className="text-xs text-muted-foreground">{MEETING_MODE_LABELS[item.meeting_mode]}</div>
        </div>
      ),
    },
    {
      key: 'due',
      header: 'Due',
      render: (item: DietFollowup) => {
        const overdue = differenceInCalendarDays(new Date(), new Date(item.diet_followup_due_at!));
        return (
          <span className={overdue > 0 ? 'text-destructive font-medium' : 'text-orange-600 font-medium'}>
            {overdue > 0 ? `${overdue}d overdue` : 'Today'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item: DietFollowup) => <DietFollowupActions followup={item} />,
    },
  ];

  const markReminderDone = async (item: DietPlanReminder) => {
    try {
      await setReminderDone.mutateAsync({ planId: item.planId, doneDay: item.milestone });
      toast.success(`Reminder for ${item.clientName} marked done`, {
        description: 'It will come back at the next milestone if no new plan is made.',
        action: {
          label: 'Undo',
          onClick: () => setReminderDone.mutate({ planId: item.planId, doneDay: item.previousDoneDay }),
        },
      });
    } catch (error: any) {
      toast.error('Failed to mark reminder done', { description: error.message });
    }
  };

  const dietPlanReminderColumns = [
    {
      key: 'clientName',
      header: 'Client Name',
      render: (item: DietPlanReminder) => (
        <span className="text-primary font-medium">{item.clientName}</span>
      ),
    },
    {
      key: 'planTitle',
      header: 'Current Plan',
      render: (item: DietPlanReminder) => (
        <div>
          <div>{item.planTitle}</div>
          <div className="text-xs text-muted-foreground">
            Started {new Date(`${item.startDate}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </div>
        </div>
      ),
    },
    {
      key: 'dayNumber',
      header: 'Status',
      render: (item: DietPlanReminder) => (
        <div>
          <span className={item.milestone > 10 ? 'text-destructive font-semibold' : item.milestone === 10 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
            {item.milestone === 5 ? 'Check-in' : item.milestone === 10 ? 'New plan due' : 'No new plan'}
          </span>
          <div className="text-xs text-muted-foreground">
            Day {item.dayNumber}{item.dayNumber > item.milestone && ` · due since day ${item.milestone}`}
          </div>
        </div>
      ),
    },
    { key: 'phone', header: 'Mobile', render: (item: DietPlanReminder) => item.phone || '-' },
    {
      key: 'actions',
      header: '',
      render: (item: DietPlanReminder) => (
        <Button
          size="sm"
          variant="outline"
          className="h-7"
          disabled={setReminderDone.isPending}
          onClick={() => markReminderDone(item)}
        >
          <Check className="h-3.5 w-3.5 mr-1" /> Mark done
        </Button>
      ),
    },
  ];

  const serviceRenewalColumns = [
    { 
      key: 'name', 
      header: 'Client Name',
      render: (item: any) => (
        <span className="text-primary font-medium cursor-pointer hover:underline">
          {item.name || '-'}
        </span>
      )
    },
    { 
      key: 'service_end_date', 
      header: 'End Date',
      render: (item: any) => new Date(item.service_end_date).toLocaleDateString()
    },
    { 
      key: 'days_left', 
      header: 'Status',
      render: (item: any) => (
        <span className={item.days_left <= 0 ? 'text-destructive font-semibold' : item.days_left <= 3 ? 'text-orange-600 font-medium' : 'text-muted-foreground'}>
          {item.days_left <= 0 ? `Expired ${Math.abs(item.days_left)}d ago` : `${item.days_left}d left`}
        </span>
      )
    },
  ];

  const balanceReceivableColumns = [
    { 
      key: 'name', 
      header: 'Client Name',
      render: (item: any) => (
        <span className="text-primary font-medium cursor-pointer hover:underline">
          {item.name || '-'}
        </span>
      )
    },
    { 
      key: 'total_receivables', 
      header: 'Unpaid Amount',
      render: (item: any) => `₹${Number(item.total_receivables || 0).toLocaleString()}`
    },
    { 
      key: 'phone', 
      header: 'Mobile',
      render: (item: any) => item.phone || '-'
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Dashboard</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="Total Active Clients"
          value={statsLoading ? '...' : String(stats?.totalActiveClients || 0)}
          tooltip="Number of currently active clients"
        />
        <StatCard
          title="Service Sales This Month"
          value={statsLoading ? '...' : String(stats?.serviceSalesThisMonth || 0)}
          tooltip="Number of clients onboarded this month with fees"
        />
      </div>

      {/* Info Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <InfoCard
          title="Today's Birthday/Anniversary"
          tooltip="Clients with birthday or anniversary today"
        >
          {birthdays.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No birthdays/anniversaries today
            </p>
          ) : (
            <ul className="space-y-2">
              {birthdays.map((item: any) => (
                <li key={item.id} className="text-sm">{item.name}</li>
              ))}
            </ul>
          )}
        </InfoCard>

        <InfoCard
          title="Today's Appointments"
          tooltip="Scheduled appointments for today"
          customAction={
            <CreateAppointmentDialog
              trigger={
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              }
            />
          }
        >
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No appointments today
            </p>
          ) : (
            <ul className="space-y-2">
              {appointments.map((item: any) => (
                <li key={item.id} className="text-sm flex items-center justify-between gap-2">
                  <span>{item.clients?.name} - {item.appointment_time?.slice(0, 5)}</span>
                  <RecordOutcomeDialog
                    appointment={item}
                    trigger={
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:text-green-700">
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Mark done
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </InfoCard>

        <InfoCard
          title="At-Risk Clients"
          tooltip="Clients with diet plans expiring in 1-2 days (red or yellow status)"
        >
          {atRiskClients.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No at-risk clients
            </p>
          ) : (
            <ul className="space-y-2">
              {atRiskClients.map((item: any) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <StatusDot color={item.color} size="sm" />
                  <span>{item.name}</span>
                  <span className="text-muted-foreground">({item.display})</span>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>

        <InfoCard
          title="Paused Clients"
          tooltip="All clients currently on a service pause with days remaining"
        >
          {pausedClients.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No clients on pause
            </p>
          ) : (
            <ul className="space-y-2">
              {pausedClients.map((item: any) => (
                <li key={item.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-blue-800 font-medium">
                    {item.daysLeft === 0 ? 'Ends today' : `${item.daysLeft} day${item.daysLeft === 1 ? '' : 's'} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataTable
          title="Appointment Reminders"
          tooltip="Today's appointments and any earlier ones not yet closed. Mark done to record the outcome (Held, no-show, etc.)."
          columns={appointmentReminderColumns}
          data={appointmentsAwaitingOutcome}
          emptyMessage="No appointments to close"
        />

        <DataTable
          title="Diet Plan Follow-ups"
          tooltip="Create the diet plan 48 hours after a held online or physical + online meeting. Push to a later date or mark done; clears automatically once a new plan is approved."
          columns={dietFollowupColumns}
          data={dietFollowups}
          emptyMessage="No diet plan follow-ups due"
        />

        <DataTable
          title="Diet Plan Reminders"
          tooltip="Appears on day 5 and day 10 of a client's latest approved diet plan, then every 10th day (20, 30, 40…) until a new plan is made. Stays until marked done."
          columns={dietPlanReminderColumns}
          data={filteredDietPlanReminders}
          emptyMessage={activeReminderFilter === 'all' ? 'No diet plan reminders today' : 'No reminders for this filter'}
          headerAction={
            <Select value={activeReminderFilter} onValueChange={setReminderFilter}>
              <SelectTrigger className="h-8 w-[200px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reminderFilterOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label} ({o.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <DataTable
          title="Service Renewal Reminders"
          tooltip="Clients whose service is ending within 7 days or already expired"
          columns={serviceRenewalColumns}
          data={serviceRenewals}
          emptyMessage="No upcoming renewals"
        />

        <DataTable
          title="Balance Receivable"
          tooltip="Outstanding payment balances"
          columns={balanceReceivableColumns}
          data={balanceReceivables}
          emptyMessage="No outstanding balances"
        />
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
