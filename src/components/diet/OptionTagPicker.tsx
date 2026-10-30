// Label for a meal option in the weekly menu: how often or when it's had
// ("2/WEEK", "THU (fast day)", "MON-WED"...), or "Always (+)" for items had
// with every option. Printed in bold before the option, as in the clinic's plans.
import { useState } from 'react';
import { Check, Tag } from 'lucide-react';
import { ALWAYS_TAG, OPTION_TAG_PRESETS } from '@/lib/manualDietPlan';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const FAST_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => `${d} (fast day)`);

interface Props {
  value: string | null | undefined;
  onChange: (tag: string | null) => void;
}

export const OptionTagPicker = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const presets = [...OPTION_TAG_PRESETS, ...FAST_DAYS].filter((p) => !q || p.toLowerCase().includes(q));

  const choose = (tag: string | null) => {
    onChange(tag);
    setSearch('');
    setOpen(false);
  };

  const label = value === ALWAYS_TAG ? 'Always +' : value || 'Label';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'mt-1 inline-flex h-8 max-w-[9.5rem] shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-semibold',
            value ? 'border-primary/40 bg-primary/10 text-primary' : 'border-dashed text-muted-foreground hover:border-foreground/40',
          )}
          title={value === ALWAYS_TAG ? 'Had with every option' : value ? `Shown as "${value}:"` : 'When is this option had? (2/WEEK, THU (fast day)...)'}
        >
          {!value && <Tag className="h-3 w-3" />}
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="2/WEEK, ON THU, MON-WED…" value={search} onValueChange={setSearch} />
          <CommandList className="max-h-[280px]">
            {search.trim() && (
              <CommandGroup>
                <CommandItem value={`custom:${search}`} onSelect={() => choose(search.trim())}>
                  Use “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem value="none" onSelect={() => choose(null)}>
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                No label
              </CommandItem>
              <CommandItem value="always" onSelect={() => choose(ALWAYS_TAG)}>
                <Check className={cn('mr-2 h-4 w-4', value === ALWAYS_TAG ? 'opacity-100' : 'opacity-0')} />
                Always (+) — with every option
              </CommandItem>
            </CommandGroup>
            {presets.length > 0 && (
              <CommandGroup heading="When">
                {presets.map((p) => (
                  <CommandItem key={p} value={`tag:${p}`} onSelect={() => choose(p)}>
                    <Check className={cn('mr-2 h-4 w-4', value === p ? 'opacity-100' : 'opacity-0')} />
                    {p}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
