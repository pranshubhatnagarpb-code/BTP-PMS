// Choose diet guidelines (from the Diet Guidelines library) to append to a plan's PDF,
// and optionally edit each one for this plan only.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronsUpDown, Pencil, ScrollText, X } from 'lucide-react';
import { useDietGuidelines, type GuidelineEdit, type GuidelineEdits } from '@/hooks/useDietGuidelines';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { GuidelineEditDialog } from './GuidelineEditDialog';
import { cn } from '@/lib/utils';

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  /** This plan's edited copies; when given with onEditsChange, selected guidelines can be edited. */
  edits?: GuidelineEdits;
  onEditsChange?: (edits: GuidelineEdits) => void;
  className?: string;
}

const withoutKey = (edits: GuidelineEdits, id: string) => {
  const next = { ...edits };
  delete next[id];
  return next;
};

export const GuidelinePicker = ({ value, onChange, edits = {}, onEditsChange, className }: Props) => {
  const { guidelines, tableMissing } = useDietGuidelines();
  const [editingId, setEditingId] = useState<string | null>(null);

  const libraryVersion = (id: string): GuidelineEdit | null => {
    const g = guidelines.find((x) => x.id === id);
    return g ? { title: g.title, html: g.content_html } : null;
  };
  // In the order chosen; an edited copy keeps showing even if the library one was deleted.
  const selected = value
    .map((id) => {
      const current = edits[id] ?? libraryVersion(id);
      return current ? { id, ...current, edited: Boolean(edits[id]) } : null;
    })
    .filter((g): g is GuidelineEdit & { id: string; edited: boolean } => Boolean(g));

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
    if (edits[id]) onEditsChange?.(withoutKey(edits, id));
  };
  const toggle = (id: string) => (value.includes(id) ? remove(id) : onChange([...value, id]));

  const label = selected.length === 0
    ? 'No guidelines'
    : selected.length === 1
      ? selected[0].title
      : `${selected.length} guidelines`;

  const editing = selected.find((g) => g.id === editingId);

  return (
    <div className={cn('space-y-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={tableMissing}>
            <span className="flex min-w-0 items-center gap-2">
              <ScrollText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className={cn('truncate', !selected.length && 'text-muted-foreground')}>{tableMissing ? 'Guidelines unavailable' : label}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search guidelines..." />
            <CommandList className="max-h-[280px]">
              <CommandEmpty>
                {guidelines.length === 0 ? (
                  <span>
                    No guidelines yet —{' '}
                    <Link to="/diet-guidelines" className="text-primary underline">
                      import one
                    </Link>
                  </span>
                ) : (
                  'No guideline found.'
                )}
              </CommandEmpty>
              <CommandGroup heading="Append to the plan's PDF">
                {guidelines.map((g) => (
                  <CommandItem key={g.id} value={`${g.title} ${g.id}`} onSelect={() => toggle(g.id)}>
                    <Check className={cn('mr-2 h-4 w-4', value.includes(g.id) ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{g.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {onEditsChange && selected.length > 0 && (
        <ul className="space-y-1">
          {selected.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
              <ScrollText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{g.title}</span>
              {g.edited && <Badge variant="secondary" className="shrink-0 text-[10px]">Edited for this plan</Badge>}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditingId(g.id)}>
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remove ${g.title}`} onClick={() => remove(g.id)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {onEditsChange && editing && (
        <GuidelineEditDialog
          open
          onOpenChange={(open) => !open && setEditingId(null)}
          initial={{ title: editing.title, html: editing.html }}
          original={libraryVersion(editing.id)}
          isEdited={editing.edited}
          onSave={(edit) => onEditsChange({ ...edits, [editing.id]: edit })}
          onReset={() => onEditsChange(withoutKey(edits, editing.id))}
        />
      )}
    </div>
  );
};
