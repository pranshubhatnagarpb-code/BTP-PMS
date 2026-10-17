import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, format, startOfDay } from 'date-fns';
import { CalendarClock, Check, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DietFollowup, useUpdateDietFollowup } from '@/hooks/useAppointments';

export const DietFollowupActions = ({ followup }: { followup: DietFollowup }) => {
  const update = useUpdateDietFollowup();
  const [pushOpen, setPushOpen] = useState(false);
  const tomorrow = addDays(startOfDay(new Date()), 1);

  const pushTo = async (date: Date | undefined) => {
    if (!date) return;
    try {
      // Due from the start of the chosen day, so it shows up as soon as that day begins.
      await update.mutateAsync({ id: followup.id, diet_followup_due_at: startOfDay(date).toISOString() });
      setPushOpen(false);
      toast.success(`Reminder for ${followup.clients.name} pushed to ${format(date, 'dd MMM yyyy')}`);
    } catch {/* toast handled in hook */}
  };

  const markDone = async () => {
    try {
      await update.mutateAsync({ id: followup.id, diet_followup_done_at: new Date().toISOString() });
      toast.success(`Diet plan reminder for ${followup.clients.name} marked done`, {
        action: {
          label: 'Undo',
          onClick: () => update.mutate({ id: followup.id, diet_followup_done_at: null }),
        },
      });
    } catch {/* toast handled in hook */}
  };

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button size="sm" variant="outline" className="h-7" asChild>
        <Link to="/diet-section"><Utensils className="h-3.5 w-3.5 mr-1" /> Create plan</Link>
      </Button>
      <Popover open={pushOpen} onOpenChange={setPushOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-7" disabled={update.isPending}>
            <CalendarClock className="h-3.5 w-3.5 mr-1" /> Push
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <p className="px-3 pt-3 text-sm font-medium">Remind again on</p>
          <Calendar
            mode="single"
            onSelect={pushTo}
            disabled={(d) => d < tomorrow}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <Button size="sm" variant="outline" className="h-7" disabled={update.isPending} onClick={markDone}>
        <Check className="h-3.5 w-3.5 mr-1" /> Done
      </Button>
    </div>
  );
};
