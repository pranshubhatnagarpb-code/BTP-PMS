import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Home, ChevronRight, Plug, CalendarDays, CheckCircle2 } from 'lucide-react';
import { useGoogleCalendarStatus, connectGoogleCalendar, disconnectGoogleCalendar } from '@/hooks/useGoogleCalendar';

const Integrations = () => {
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
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Integrations</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Plug className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
      </div>

      <div className="max-w-xl rounded-lg border bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-foreground">Google Calendar & Meet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When connected, every new appointment automatically gets a Google Meet link scheduled
              on this account's calendar, with the client invited by email.
            </p>

            {isLoading ? (
              <p className="mt-4 text-sm text-muted-foreground">Checking connection…</p>
            ) : status?.connected ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  Connected{status.email ? ` as ${status.email}` : ''}
                </div>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Button size="sm" onClick={connectGoogleCalendar}>
                  Connect Google Calendar
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Integrations;
