import { useState } from 'react';
import { Copy, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  MESSAGE_TEMPLATE_LABELS,
  MessageAppointment,
  MessageTemplate,
  buildAppointmentMessage,
  defaultTemplateFor,
  isMessageSendDay,
} from '@/lib/appointmentMessages';

interface Props {
  appointment: MessageAppointment;
}

// Personalised appointment message for staff to copy and paste to the client.
// The template is picked from the appointment, and can be switched if needed;
// the text stays editable before copying.
export const AppointmentMessageDialog = ({ appointment }: Props) => {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<MessageTemplate>(() => defaultTemplateFor(appointment));
  const [text, setText] = useState('');
  const sendToday = isMessageSendDay(appointment.appointment_date);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const initial = defaultTemplateFor(appointment);
      setTemplate(initial);
      setText(buildAppointmentMessage(appointment, initial));
    }
  };

  const changeTemplate = (next: MessageTemplate) => {
    setTemplate(next);
    setText(buildAppointmentMessage(appointment, next));
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied — ready to paste and send to the client.');
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {sendToday ? (
          <Button
            size="sm"
            className="relative bg-amber-500 text-white hover:bg-amber-600 animate-pulse hover:animate-none"
            title="Appointment is tomorrow — send this message today"
          >
            <MessageSquareText className="h-4 w-4 mr-1" /> Send today
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <MessageSquareText className="h-4 w-4 mr-1" /> Message
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Appointment Message{appointment.clients?.name ? ` — ${appointment.clients.name}` : ''}</DialogTitle>
          <DialogDescription>
            {sendToday
              ? 'The appointment is tomorrow — send this today. Review, then copy and paste it to the client on WhatsApp.'
              : 'Messages are sent the day before the appointment. Review, then copy and paste it to the client on WhatsApp.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-left">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={template} onValueChange={(v) => changeTemplate(v as MessageTemplate)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MESSAGE_TEMPLATE_LABELS) as MessageTemplate[]).map((t) => (
                  <SelectItem key={t} value={t}>{MESSAGE_TEMPLATE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={16} className="text-sm" />
          <Button className="w-full" onClick={copy}>
            <Copy className="h-4 w-4 mr-2" /> Copy Message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
