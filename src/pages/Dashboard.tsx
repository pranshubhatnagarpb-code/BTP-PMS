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
} from '@/hooks/useDashboardData';
import { useTodaysBirthdays } from '@/hooks/useClients';
import { Home, ChevronRight } from 'lucide-react';
import { CreateAppointmentDialog } from '@/components/appointments/CreateAppointmentDialog';

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: appointments = [] } = useTodaysAppointments();
  const { data: birthdays = [] } = useTodaysBirthdays();
  const { data: balanceReceivables = [] } = useBalanceReceivables();
  const { data: serviceRenewals = [] } = useServiceRenewalReminders();

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
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
          customAction={<CreateAppointmentDialog />}
        >
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              No appointments today
            </p>
          ) : (
            <ul className="space-y-2">
              {appointments.map((item: any) => (
                <li key={item.id} className="text-sm">
                  {item.clients?.name} - {item.appointment_time?.slice(0, 5)}
                </li>
              ))}
            </ul>
          )}
        </InfoCard>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
