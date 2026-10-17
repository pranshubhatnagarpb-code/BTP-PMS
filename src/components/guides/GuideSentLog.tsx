import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CHANNEL_LABELS, GuideSend, useDeleteGuideSend, useRecordGuideSends } from '@/hooks/useGuideSends';

// Full track record of which guide was sent to which client.
export const GuideSentLog = ({ sends }: { sends: GuideSend[] }) => {
  const [search, setSearch] = useState('');
  const deleteSend = useDeleteGuideSend();
  const recordSend = useRecordGuideSends();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sends;
    return sends.filter((s) => `${s.clients?.name ?? ''} ${s.guide_title}`.toLowerCase().includes(q));
  }, [sends, search]);

  const remove = async (send: GuideSend) => {
    try {
      await deleteSend.mutateAsync(send);
      toast.success('Record removed', {
        action: {
          label: 'Undo',
          onClick: () => recordSend.mutate({
            guide: { id: send.guide_id, title: send.guide_title },
            clientIds: [send.client_id],
            sentOn: send.sent_on,
            channel: send.channel,
            notes: send.notes ?? undefined,
          }),
        },
      });
    } catch {/* toast handled in hook */}
  };

  return (
    <div className="space-y-4">
      <div className="relative sm:w-72">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by client or guide" className="pl-9" />
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Sent on</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Guide</TableHead>
              <TableHead className="w-[110px]">Channel</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {sends.length === 0 ? 'No guides marked as sent yet.' : 'No records match your search.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{format(parseISO(s.sent_on), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="font-medium">{s.clients?.name ?? 'Deleted client'}</TableCell>
                  <TableCell>
                    {s.guide_title}
                    {!s.guide_id && <span className="ml-1 text-xs text-muted-foreground">(guide deleted)</span>}
                  </TableCell>
                  <TableCell>{CHANNEL_LABELS[s.channel] ?? s.channel}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.notes || '—'}</TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      title="Remove record"
                      disabled={deleteSend.isPending}
                      onClick={() => remove(s)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
