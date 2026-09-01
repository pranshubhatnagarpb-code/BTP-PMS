import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { NotebookText, CalendarPlus, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClientTimeline, useAddClientNote, type TimelineEntry } from '@/hooks/useClientNotes';

interface Props {
  clientId: string;
  clientName: string;
}

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  diet_review: 'Diet Review',
  checkup: 'Checkup',
};

const TimelineItem = ({ entry }: { entry: TimelineEntry }) => {
  const when = format(parseISO(entry.at), 'dd MMM yyyy, h:mm a');

  if (entry.type === 'note') {
    return (
      <div className="flex gap-3">
        <NotebookText className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div>
          <p className="text-sm whitespace-pre-wrap">{entry.text}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{when}</p>
        </div>
      </div>
    );
  }

  if (entry.type === 'scheduled') {
    return (
      <div className="flex gap-3">
        <CalendarPlus className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <div>
          <p className="text-sm">
            <span className="font-medium">Appointment scheduled</span> — {APPOINTMENT_TYPE_LABELS[entry.appointmentType] || entry.appointmentType} on{' '}
            {format(parseISO(entry.appointmentDate), 'dd MMM yyyy')} at {entry.appointmentTime.slice(0, 5)}
          </p>
          {entry.notes && <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{entry.notes}</p>}
          <p className="text-[11px] text-muted-foreground mt-0.5">{when}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <CalendarClock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
      <div>
        <p className="text-sm">
          <span className="font-medium">Appointment rescheduled</span> — {format(parseISO(entry.previousDate), 'dd MMM yyyy')}{' '}
          {entry.previousTime.slice(0, 5)} → {format(parseISO(entry.newDate), 'dd MMM yyyy')} {entry.newTime.slice(0, 5)}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{when}</p>
      </div>
    </div>
  );
};

export const ClientNotesDialog = ({ clientId, clientName }: Props) => {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const { data: timeline = [], isLoading } = useClientTimeline(clientId, open);
  const addNote = useAddClientNote();

  const handleAddNote = () => {
    if (!note.trim()) return;
    addNote.mutate(
      { clientId, note: note.trim() },
      { onSuccess: () => setNote('') }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-1 text-muted-foreground shrink-0"
          title="Notes & history"
          onClick={(e) => e.stopPropagation()}
        >
          <NotebookText className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Notes — {clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened in this conversation?"
            rows={3}
          />
          <Button size="sm" onClick={handleAddNote} disabled={!note.trim() || addNote.isPending}>
            {addNote.isPending ? 'Adding...' : 'Add Note'}
          </Button>
        </div>

        <ScrollArea className="h-80 mt-2 pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No notes or appointment history yet.</p>
          ) : (
            <div className="space-y-4">
              {timeline.map((entry) => (
                <TimelineItem key={`${entry.type}-${entry.id}`} entry={entry} />
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
