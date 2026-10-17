import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Appointment, useRecordAppointmentOutcome } from '@/hooks/useAppointments';
import {
  AppointmentOutcome,
  DIET_FOLLOWUP_DELAY_HOURS,
  MEETING_MODE_LABELS,
  OUTCOME_LABELS,
  dietFollowupDueAt,
} from '@/lib/appointmentOutcomes';

interface Props {
  appointment: Pick<Appointment, 'id' | 'meeting_mode' | 'outcome' | 'outcome_notes'> & { clients?: { name: string } };
  trigger?: React.ReactNode;
}

export const RecordOutcomeDialog = ({ appointment, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<AppointmentOutcome>('held');
  const [notes, setNotes] = useState('');
  const record = useRecordAppointmentOutcome();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setOutcome(appointment.outcome ?? 'held');
      setNotes(appointment.outcome_notes ?? '');
    }
  };

  const createsFollowup = dietFollowupDueAt(appointment.meeting_mode, outcome, new Date()) !== null;
  const notesRequired = outcome === 'other';

  const handleSubmit = () => {
    record.mutate(
      { appointment, outcome, notes },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700">
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark done
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Appointment Outcome</DialogTitle>
          <DialogDescription>
            {appointment.clients?.name ?? 'Client'} · {MEETING_MODE_LABELS[appointment.meeting_mode]}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <RadioGroup value={outcome} onValueChange={(v) => setOutcome(v as AppointmentOutcome)} className="grid grid-cols-2 gap-2">
            {(Object.keys(OUTCOME_LABELS) as AppointmentOutcome[]).map((o) => (
              <Label
                key={o}
                htmlFor={`outcome-${o}`}
                className="flex cursor-pointer items-center gap-2 rounded-md border p-3 font-normal has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <RadioGroupItem value={o} id={`outcome-${o}`} />
                {OUTCOME_LABELS[o]}
              </Label>
            ))}
          </RadioGroup>

          <div className="space-y-2">
            <Label htmlFor="outcome-notes">Notes{notesRequired ? ' *' : ''}</Label>
            <Textarea
              id="outcome-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={notesRequired ? 'What happened?' : 'Optional — anything discussed or to follow up'}
              rows={3}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {createsFollowup
              ? `A reminder to create the diet plan will appear on the dashboard in ${DIET_FOLLOWUP_DELAY_HOURS} hours.`
              : appointment.meeting_mode === 'physical' && outcome === 'held'
                ? 'Physical meeting — no diet plan reminder will be set.'
                : 'No diet plan reminder will be set for this outcome.'}
          </p>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={record.isPending || (notesRequired && !notes.trim())}
          >
            {record.isPending ? 'Saving…' : 'Save Outcome'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
