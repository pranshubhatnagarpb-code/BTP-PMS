import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateAppointmentDialog } from '@/components/appointments/CreateAppointmentDialog';
import { RescheduleDialog } from '@/components/appointments/RescheduleDialog';
import { useAllAppointments, useUpdateAppointmentStatus, useGenerateMeetLink, useAppointmentRescheduleHistory } from '@/hooks/useAppointments';
import { useGoogleCalendarStatus, connectGoogleCalendar, disconnectGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useClients } from '@/hooks/useClients';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Home, ChevronRight, CalendarDays, CheckCircle2, XCircle, Video, Loader2, History, Ban, Plug } from 'lucide-react';
import { format, isToday, isFuture, isPast, parseISO } from 'date-fns';

const GoogleCalendarStatusCard = () => {
  const { data: status, isLoading } = useGoogleCalendarStatus();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get('google_connected')) {
      toast.success('Google Calendar connected');
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('google_error')) {
      toast.error('Could not connect Google Calendar', { description: searchParams.get('google_error')! });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  const handleDisconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      toast.success('Google Calendar disconnected');
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] });
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <Plug className="h-4 w-4 text-primary shrink-0" />
        {isLoading ? (
          <span className="text-sm text-muted-foreground">Checking Google Calendar connection…</span>
        ) : status?.connected ? (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Google Calendar connected{status.email ? ` as ${status.email}` : ''}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Google Calendar not connected — appointments won't get a Meet link until you connect it.
          </span>
        )}
      </div>
      {!isLoading && (
        status?.connected ? (
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={connectGoogleCalendar}>
            Connect Google Calendar
          </Button>
        )
      )}
    </div>
  );
};

const RescheduleHistory = ({ appointmentId }: { appointmentId: string }) => {
  const [open, setOpen] = useState(false);
  const { data: history = [], isLoading } = useAppointmentRescheduleHistory(appointmentId, open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" title="Reschedule history">
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="text-sm font-medium mb-2">Reschedule History</p>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No reschedules yet</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-xs">
                <span className="text-muted-foreground">
                  {format(parseISO(h.previous_date), 'dd MMM yyyy')} {h.previous_time.slice(0, 5)}
                </span>
                {' → '}
                <span className="font-medium">
                  {format(parseISO(h.new_date), 'dd MMM yyyy')} {h.new_time.slice(0, 5)}
                </span>
                <div className="text-[10px] text-muted-foreground">
                  {format(parseISO(h.rescheduled_at), 'dd MMM yyyy, h:mm a')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-muted text-muted-foreground',
};

const Appointments = () => {
  const { data: appointments = [], isLoading } = useAllAppointments();
  const { data: clients = [] } = useClients();
  const updateStatus = useUpdateAppointmentStatus();
  const generateMeetLink = useGenerateMeetLink();
  const [tab, setTab] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = appointments.filter((a) => {
    const d = parseISO(a.appointment_date);
    const matchesDate = (isFuture(d) || isToday(d)) && a.status === 'scheduled';
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesClient = clientFilter === 'all' || a.clients?.id === clientFilter;
    return matchesDate && matchesStatus && matchesClient;
  });

  const past = appointments.filter((a) => {
    const d = parseISO(a.appointment_date);
    const matchesDate = isPast(d) && !isToday(d);
    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesClient = clientFilter === 'all' || a.clients?.id === clientFilter;
    return matchesDate && matchesStatus && matchesClient;
  });

  const renderTable = (list: typeof appointments, showActions: boolean) => (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Meeting</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 7 : 6} className="text-center text-muted-foreground py-8">
                No appointments found
              </TableCell>
            </TableRow>
          ) : (
            list.map((apt) => (
              <TableRow key={apt.id}>
                <TableCell className="font-medium">{(apt as any).clients?.name || '-'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {format(parseISO(apt.appointment_date), 'dd MMM yyyy')}
                    <RescheduleHistory appointmentId={apt.id} />
                  </div>
                </TableCell>
                <TableCell>{apt.appointment_time?.slice(0, 5)}</TableCell>
                <TableCell className="capitalize">{apt.appointment_type.replace('_', ' ')}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[apt.status] || ''}>
                    {apt.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  {apt.meet_link ? (
                    <a
                      href={apt.meet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Video className="h-3.5 w-3.5" /> Join
                    </a>
                  ) : apt.status === 'cancelled' ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      disabled={generateMeetLink.isPending}
                      onClick={() => generateMeetLink.mutate(apt.id)}
                    >
                      {generateMeetLink.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Video className="mr-1 h-3.5 w-3.5" /> Generate Link
                        </>
                      )}
                    </Button>
                  )}
                </TableCell>
                {showActions && (
                  <TableCell className="text-right space-x-2">
                    {apt.status === 'scheduled' && (
                      <>
                        <RescheduleDialog
                          appointmentId={apt.id}
                          currentDate={apt.appointment_date}
                          currentTime={apt.appointment_time}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => updateStatus.mutate({ id: apt.id, status: 'completed' })}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Done
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => updateStatus.mutate({ id: apt.id, status: 'no_show' })}
                          disabled={updateStatus.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" /> No Show
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => updateStatus.mutate({ id: apt.id, status: 'cancelled' })}
                          disabled={updateStatus.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Appointments</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
        </div>
        <CreateAppointmentDialog />
      </div>

      <GoogleCalendarStatusCard />

      {/* Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status Filter:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Client Filter:</span>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{renderTable(upcoming, true)}</TabsContent>
        <TabsContent value="past">{renderTable(past, true)}</TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Appointments;
