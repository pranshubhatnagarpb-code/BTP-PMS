import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CreateAppointmentDialog } from '@/components/appointments/CreateAppointmentDialog';
import { useAllAppointments, useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { useClients } from '@/hooks/useClients';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Home, ChevronRight, CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { format, isToday, isFuture, isPast, parseISO } from 'date-fns';

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
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-8">
                No appointments found
              </TableCell>
            </TableRow>
          ) : (
            list.map((apt) => (
              <TableRow key={apt.id}>
                <TableCell className="font-medium">{(apt as any).clients?.name || '-'}</TableCell>
                <TableCell>{format(parseISO(apt.appointment_date), 'dd MMM yyyy')}</TableCell>
                <TableCell>{apt.appointment_time?.slice(0, 5)}</TableCell>
                <TableCell className="capitalize">{apt.appointment_type.replace('_', ' ')}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[apt.status] || ''}>
                    {apt.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right space-x-2">
                    {apt.status === 'scheduled' && (
                      <>
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
