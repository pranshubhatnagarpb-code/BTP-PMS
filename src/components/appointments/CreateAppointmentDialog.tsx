import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateAppointment } from '@/hooks/useAppointments';

interface Props {
  trigger?: React.ReactNode;
}

export const CreateAppointmentDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState('consultation');
  const [notes, setNotes] = useState('');

  const { data: clients = [] } = useActiveClients();
  const createAppointment = useCreateAppointment();

  const handleSubmit = () => {
    if (!clientId || !date || !time) return;

    createAppointment.mutate(
      {
        client_id: clientId,
        appointment_date: format(date, 'yyyy-MM-dd'),
        appointment_time: time,
        appointment_type: type,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setClientId('');
          setDate(undefined);
          setTime('10:00');
          setType('consultation');
          setNotes('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> Create Appointment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Client */}
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date *</Label>
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
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label>Time *</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="diet_review">Diet Review</SelectItem>
                <SelectItem value="checkup">Checkup</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={!clientId || !date || !time || createAppointment.isPending}>
            {createAppointment.isPending ? 'Creating...' : 'Create Appointment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
