import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronsUpDown, Pill, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { supplementLine, useSupplements } from '@/hooks/useSupplements';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const splitLines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

// Selecting a supplement adds its line to the supplements text; selecting it again removes it.
// The text stays free-form, so the nutritionist can still tweak lines or type extra ones.
export const SupplementPicker = ({ value, onChange }: Props) => {
  const { data: supplements = [], isLoading } = useSupplements();
  const [open, setOpen] = useState(false);

  const lines = splitLines(value);
  const active = supplements.filter((s) => s.is_active);
  const selectedCount = active.filter((s) => lines.includes(supplementLine(s))).length;

  const toggle = (line: string) => {
    const next = lines.includes(line) ? lines.filter((l) => l !== line) : [...lines, line];
    onChange(next.join('\n'));
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Pill className="h-4 w-4" />
              {selectedCount > 0 ? `${selectedCount} selected from list` : 'Select supplements from list'}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search supplements…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>{isLoading ? 'Loading…' : 'No supplement found.'}</CommandEmpty>
              <CommandGroup>
                {active.map((s) => {
                  const line = supplementLine(s);
                  const selected = lines.includes(line);
                  return (
                    <CommandItem key={s.id} value={`${s.name} ${s.directions}`} onSelect={() => toggle(line)} className="items-start">
                      <Check className={cn('mr-2 mt-0.5 h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                      <div className="min-w-0">
                        <div className="font-medium">{s.name}</div>
                        {s.directions && <div className="text-xs text-muted-foreground line-clamp-2">{s.directions}</div>}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button type="button" variant="ghost" size="icon" asChild title="Edit supplement list">
        {/* New tab so the in-progress plan form isn't lost; the list refetches on window focus. */}
        <Link to="/supplements" target="_blank" rel="noreferrer"><Settings2 className="h-4 w-4" /></Link>
      </Button>
    </div>
  );
};
