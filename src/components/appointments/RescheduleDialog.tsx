import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRescheduleAppointment } from '@/hooks/useAppointments';

interface Props {
  appointmentId: string;
  currentDate: string; // yyyy-MM-dd
  currentTime: string; // HH:mm[:ss]
}

export const RescheduleDialog = ({ appointmentId, currentDate, currentTime }: Props) => {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState(currentTime.slice(0, 5));

  const reschedule = useRescheduleAppointment();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Reset to the appointment's current values each time the dialog opens.
      setDate(parseISO(currentDate));
      setTime(currentTime.slice(0, 5));
    }
  };

  const handleSubmit = () => {
    if (!date || !time) return;

    reschedule.mutate(
      {
        id: appointmentId,
        previousDate: currentDate,
        previousTime: currentTime,
        newDate: format(date, 'yyyy-MM-dd'),
        newTime: time,
      },
      { onSuccess: () => setOpen(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock className="h-4 w-4 mr-1" /> Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>New Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>New Time *</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!date || !time || reschedule.isPending}>
            {reschedule.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
