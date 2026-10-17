import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useActiveClients } from '@/hooks/useClients';
import type { Guide } from '@/hooks/useGuides';
import {
  CHANNEL_LABELS,
  GuideSendChannel,
  todayLocal,
  useGuideSends,
  useRecordGuideSends,
} from '@/hooks/useGuideSends';

interface Props {
  guide: Guide | null;
  onOpenChange: (open: boolean) => void;
}

export const MarkGuideSentDialog = ({ guide, onOpenChange }: Props) => {
  const { data: clients = [] } = useActiveClients();
  const { data: sends = [] } = useGuideSends();
  const record = useRecordGuideSends();

  const [selected, setSelected] = useState<string[]>([]);
  const [sentOn, setSentOn] = useState(todayLocal());
  const [channel, setChannel] = useState<GuideSendChannel>('whatsapp');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (guide) {
      setSelected([]);
      setSentOn(todayLocal());
      setChannel('whatsapp');
      setNotes('');
    }
  }, [guide]);

  // Most recent date this guide was already sent to each client.
  const lastSentTo = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sends) {
      if (s.guide_id === guide?.id && !map.has(s.client_id)) map.set(s.client_id, s.sent_on);
    }
    return map;
  }, [sends, guide]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client';

  const save = async () => {
    if (!guide || selected.length === 0) return;
    try {
      await record.mutateAsync({ guide, clientIds: selected, sentOn, channel, notes });
      toast.success(`Marked "${guide.title}" as sent to ${selected.length} client${selected.length === 1 ? '' : 's'}`);
      onOpenChange(false);
    } catch {/* toast handled in hook */}
  };

  return (
    <Dialog open={!!guide} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mark Guide as Sent</DialogTitle>
          <DialogDescription>{guide?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Clients *</Label>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {nameOf(id)}
                    <button type="button" onClick={() => toggle(id)} aria-label={`Remove ${nameOf(id)}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Command className="rounded-md border">
              <CommandInput placeholder="Search clients…" />
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No client found.</CommandEmpty>
                <CommandGroup>
                  {clients.map((c) => {
                    const last = lastSentTo.get(c.id);
                    return (
                      <CommandItem key={c.id} value={`${c.name} ${c.phone ?? ''}`} onSelect={() => toggle(c.id)}>
                        <Check className={cn('mr-2 h-4 w-4', selected.includes(c.id) ? 'opacity-100' : 'opacity-0')} />
                        <span className="flex-1">{c.name}</span>
                        {last && (
                          <span className="text-xs text-warning">already sent {format(parseISO(last), 'dd MMM yy')}</span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="sent-on">Sent on</Label>
              <Input id="sent-on" type="date" value={sentOn} max={todayLocal()} onChange={(e) => setSentOn(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as GuideSendChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNEL_LABELS) as GuideSendChannel[]).map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-notes">Notes</Label>
            <Textarea id="send-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={record.isPending || selected.length === 0 || !sentOn}>
            {record.isPending ? 'Saving…' : `Mark as sent${selected.length ? ` (${selected.length})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
