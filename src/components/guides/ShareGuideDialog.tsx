import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { Check, CheckCircle2, ChevronsUpDown, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Client, useActiveClients } from '@/hooks/useClients';
import { Guide, guideUrl } from '@/hooks/useGuides';
import { toWhatsAppNumber, whatsAppShareUrl } from '@/lib/whatsapp';
import { todayLocal, useGuideSends, useRecordGuideSends } from '@/hooks/useGuideSends';

interface Props {
  guide: Guide | null;
  onOpenChange: (open: boolean) => void;
}

const buildMessage = (guide: Guide, client: Client | null) => {
  const greeting = client ? `Hi ${client.address_as?.trim() || client.name},` : 'Hi,';
  return `${greeting}\n\nSharing the "${guide.title}" guide with you:\n${guideUrl(guide)}\n\n— Team Bounce The Pound`;
};

export const ShareGuideDialog = ({ guide, onOpenChange }: Props) => {
  const { data: clients = [] } = useActiveClients();
  const [client, setClient] = useState<Client | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState('');
  // Set once WhatsApp has been opened, so staff can confirm the send afterwards.
  const [opened, setOpened] = useState(false);
  const { data: sends = [] } = useGuideSends();
  const record = useRecordGuideSends();

  useEffect(() => {
    if (guide) {
      setClient(null);
      setOpened(false);
      setMessage(buildMessage(guide, null));
    }
  }, [guide]);

  const selectClient = (c: Client | null) => {
    setClient(c);
    setPickerOpen(false);
    setOpened(false);
    if (guide) setMessage(buildMessage(guide, c));
  };

  const lastSent = useMemo(
    () => sends.find((s) => s.guide_id === guide?.id && s.client_id === client?.id)?.sent_on ?? null,
    [sends, guide, client],
  );

  const markSent = async () => {
    if (!guide || !client) return;
    try {
      await record.mutateAsync({ guide, clientIds: [client.id], sentOn: todayLocal(), channel: 'whatsapp' });
      toast.success(`Marked as sent to ${client.name}`);
      onOpenChange(false);
    } catch {/* toast handled in hook */}
  };

  const hasNumber = !!toWhatsAppNumber(client?.phone);

  return (
    <Dialog open={!!guide} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share on WhatsApp</DialogTitle>
          <DialogDescription>{guide?.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {client ? client.name : <span className="text-muted-foreground">Select a client (optional)</span>}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search clients…" />
                  <CommandList className="max-h-[260px]">
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem key={c.id} value={`${c.name} ${c.phone ?? ''}`} onSelect={() => selectClient(c)}>
                          <Check className={cn('mr-2 h-4 w-4', client?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="flex-1">{c.name}</span>
                          <span className="text-xs text-muted-foreground">{c.phone || 'no phone'}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {lastSent && (
              <p className="text-xs text-warning">
                Already sent to {client?.name} on {format(parseISO(lastSent), 'dd MMM yyyy')}.
              </p>
            )}
            {client && !hasNumber && (
              <p className="text-xs text-warning">
                {client.name} has no valid phone number — WhatsApp will ask you to pick the contact.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-message">Message</Label>
            <Textarea id="share-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} />
          </div>

          <Button className="w-full" variant={opened ? 'outline' : 'default'} asChild>
            <a href={whatsAppShareUrl(message, client?.phone)} target="_blank" rel="noopener noreferrer" onClick={() => setOpened(true)}>
              <MessageCircle className="h-4 w-4 mr-2" /> {opened ? 'Open WhatsApp again' : 'Open WhatsApp'}
            </a>
          </Button>
          {opened && (
            client ? (
              <Button className="w-full" onClick={markSent} disabled={record.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Sent it — mark as sent to {client.name}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Select the client above to record this in the guide's sent log.
              </p>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
