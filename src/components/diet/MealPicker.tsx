// Searchable meal picker for the manual planner: pick from the meal options
// list or the meals list (clinic meal names + recipe bank), or type any meal.
// Meals that are recipe bank dishes keep their recipe, so the PDF links to it.
import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, PenLine, Youtube } from 'lucide-react';
import type { DietOption } from '@/hooks/useDietOptions';
import type { ManualMealOption, MealChoice } from '@/lib/manualDietPlan';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

// The meals list has 2,000+ entries; only this many matches are listed.
const MAX_RESULTS = 50;

const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

interface Props {
  value: ManualMealOption;
  onChange: (value: ManualMealOption) => void;
  /** Meal options to offer first (already filtered to the meal time when it's a standard one). */
  mealOptions: DietOption[];
  /** Clinic meal names merged with the recipe bank (see buildMealChoices). */
  choices: MealChoice[];
  placeholder?: string;
}

export const MealPicker = ({ value, onChange, mealOptions, choices, placeholder = 'Pick or type a meal' }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  // A meal option or typed meal that is also a recipe bank dish gets its recipe too.
  const recipeByText = useMemo(() => {
    const map = new Map<string, string>();
    choices.forEach((c) => c.recipe && map.set(normalize(c.text), c.recipe));
    return map;
  }, [choices]);

  const matchingOptions = useMemo(
    () => mealOptions.filter((o) => !q || o.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS),
    [mealOptions, q],
  );
  const matchingMeals = useMemo(() => {
    if (!q) return choices.slice(0, MAX_RESULTS);
    // Names starting with the search first, then any containing it.
    const starts = choices.filter((c) => c.text.toLowerCase().startsWith(q));
    const contains = choices.filter((c) => !c.text.toLowerCase().startsWith(q) && c.text.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [choices, q]);

  const choose = (next: ManualMealOption) => {
    onChange({ ...next, recipe: next.recipe ?? recipeByText.get(normalize(next.text)) ?? null });
    setSearch('');
    setOpen(false);
  };

  return (
    <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          // Start from the current text so a typed meal can be edited.
          if (o) setSearch(value.optionId || value.recipe ? '' : value.text);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            // Long meals wrap (up to 3 lines) instead of being cut off.
            className={cn('h-auto min-h-9 w-full justify-between gap-2 whitespace-normal py-2 text-left font-normal', !value.text && 'text-muted-foreground')}
            title={value.text || undefined}
          >
            <span className="flex min-w-0 items-start gap-1.5">
              {value.recipe && <Youtube className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" aria-label="Has recipe video" />}
              <span className="line-clamp-3 break-words">{value.text || placeholder}</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search or type a meal..." value={search} onValueChange={setSearch} />
            <CommandList className="max-h-[320px]">
              {search.trim() && (
                <CommandGroup>
                  <CommandItem value={`typed:${search}`} onSelect={() => choose({ text: search.trim(), optionId: null })}>
                    <PenLine className="mr-2 h-4 w-4" />
                    Use “{search.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
              {matchingOptions.length > 0 && (
                <CommandGroup heading="Meal options">
                  {matchingOptions.map((o) => (
                    <CommandItem key={o.id} value={`option:${o.id}`} onSelect={() => choose({ text: o.name, optionId: o.id })}>
                      <Check className={cn('mr-2 h-4 w-4', value.optionId === o.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 line-clamp-2">{o.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{o.calories} kcal</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {matchingMeals.length > 0 && (
                <CommandGroup heading="Meals">
                  {matchingMeals.map((c) => (
                    <CommandItem
                      key={c.text}
                      value={`meal:${c.text}`}
                      onSelect={() => choose({ text: c.text, optionId: null, recipe: c.recipe })}
                      title={c.recipe && c.recipe !== c.text ? `Recipe: ${c.recipe}` : undefined}
                    >
                      <Check className={cn('mr-2 h-4 w-4', !value.optionId && value.text === c.text ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 line-clamp-2">{c.text}</span>
                      {c.recipe && <Youtube className="ml-2 h-3.5 w-3.5 shrink-0 text-red-600" aria-label="Has recipe video" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!search.trim() && matchingOptions.length === 0 && matchingMeals.length === 0 && (
                <CommandEmpty>No meals yet — type one.</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
    </Popover>
  );
};
