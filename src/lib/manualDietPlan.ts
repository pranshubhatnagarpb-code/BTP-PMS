// Manual diet planner: plan shape, conversion of saved days (including plans
// saved before custom meal times existed) and the PDF, which goes through the
// same clinic document as the AI plan (dietPlanDocument).
import { fetchAllMealRecipes } from '@/lib/mealRecipes';
import {
  OPTION_TAG,
  formatServing,
  getDefaultDocumentHeader,
  printDietPlan,
  toBulletList,
  type DietDocumentDay,
  type DietDocumentFormat,
  type DietDocumentMeal,
  type DietDocumentRecipe,
} from '@/lib/dietPlanDocument';

/** One option for a meal time: picked from the meal options list (optionId), the meals list, or typed. */
export interface ManualMealOption {
  text: string;
  optionId?: string | null;
  /** Recipe bank dish it was picked as; the PDF includes that recipe (and its video link). */
  recipe?: string | null;
  /**
   * When this option applies, printed in bold before it: "2/WEEK", "THU (fast day)",
   * "MON-WED"... ALWAYS_TAG = had with every option ("tea + [option] OR [option]").
   */
  tag?: string | null;
}

export const ALWAYS_TAG = 'ALWAYS';

export interface ManualMealTime {
  /** Meal time name, e.g. "Breakfast" (MEAL TYPE column). */
  time: string;
  options: ManualMealOption[];
  /** Clock time, e.g. "10.00 am" (TIME column). */
  at?: string;
  /** Full-width note under this meal, e.g. "Walk for 10-15 mins post breakfast". */
  note?: string;
}

/** day_label of a plan written as one weekly menu (no days), like Ishwari's plan. */
export const WEEKLY_MENU_LABEL = 'Weekly menu';

/** Option labels offered in the planner (any other text can be typed). */
export const OPTION_TAG_PRESETS = [
  '1/WEEK',
  '2/WEEK',
  '3/WEEK',
  '4/WEEK',
  '1/WEEK (compulsory)',
  '2/WEEK (compulsory)',
  'DAILY',
  'MON-WED-FRI',
  'TUE-THU-SAT',
  'MON',
  'TUE',
  'WED',
  'THU',
  'FRI',
  'SAT',
  'SUN',
];

export interface ManualPlanDay {
  label: string;
  meals: ManualMealTime[];
  notes: string;
  /** Only meals picked from the meal options list carry calories; 0 = none. */
  calories: number;
}

export const DEFAULT_MEAL_TIMES = ['Breakfast', 'Lunch', 'Snacks', 'Dinner'];

// The four meal times the old per-day columns (and diet_options.meal_type) use.
export const LEGACY_MEAL_COLUMNS = {
  breakfast: 'breakfast_option_id',
  lunch: 'lunch_option_id',
  snacks: 'snacks_option_id',
  dinner: 'dinner_option_id',
} as const;

export const legacyMealKey = (time: string) => {
  const key = time.trim().toLowerCase();
  return key in LEGACY_MEAL_COLUMNS ? (key as keyof typeof LEGACY_MEAL_COLUMNS) : null;
};

const filled = (meals: ManualMealTime[]) =>
  meals
    .map((m) => ({ ...m, time: m.time.trim(), options: m.options.filter((o) => o.text?.trim()) }))
    .filter((m) => m.time && m.options.length);

/** A saved diet_plan_days row -> meal times. Older rows only have the four option columns. */
export const mealsFromSavedDay = (day: Record<string, any>): ManualMealTime[] => {
  if (Array.isArray(day.meals) && day.meals.length) return filled(day.meals as ManualMealTime[]);
  return (Object.keys(LEGACY_MEAL_COLUMNS) as (keyof typeof LEGACY_MEAL_COLUMNS)[])
    .map((key): ManualMealTime | null => {
      const option = day[`${key}_option`];
      return option?.name
        ? { time: key[0].toUpperCase() + key.slice(1), options: [{ text: option.name, optionId: option.id }] }
        : null;
    })
    .filter((m): m is ManualMealTime => m !== null);
};

export const savedDayToPlanDay = (day: Record<string, any>): ManualPlanDay => ({
  label: day.day_label || '',
  meals: mealsFromSavedDay(day),
  notes: day.notes || '',
  calories: Number(day.total_calories) || 0,
});

/**
 * Calories for a day: Option 1 of each meal time when it was picked from the
 * meal options list (other options are alternatives, not extra food).
 */
export const dayCalories = (meals: ManualMealTime[], caloriesById: Map<string, number>) =>
  meals.reduce((sum, m) => {
    const first = m.options.find((o) => o.text?.trim());
    return sum + (first?.optionId ? caloriesById.get(first.optionId) ?? 0 : 0);
  }, 0);

export const hasAnyMeal = (days: ManualPlanDay[]) => days.some((d) => filled(d.meals).length > 0);

const optionLabel = (options: ManualMealOption[], i: number, text: string) =>
  options.length > 1 ? `**Option ${i + 1}:** ${text}` : text;

/**
 * A meal's options in the weekly-menu text style the PDF renders (see
 * formatMenuHtml): items had with every option, "+", then the options with
 * their labels, separated by "OR".
 */
export const optionsToMenuText = (options: ManualMealOption[]) => {
  const always = options.filter((o) => o.tag === ALWAYS_TAG).map((o) => o.text.trim());
  const choices = options
    .filter((o) => o.tag !== ALWAYS_TAG)
    .map((o) => (o.tag?.trim() ? `${o.tag.trim().toUpperCase().replace(/\((.*?)\)/g, (_, inner) => `(${inner.toLowerCase()})`)}: ${o.text.trim()}` : o.text.trim()));
  return [always.join('\n+\n'), choices.join('\nOR\n')].filter(Boolean).join('\n+\n');
};

const usesLabels = (options: ManualMealOption[]) => options.some((o) => o.tag?.trim());

/**
 * Days for the clinic document. Labelled options (weekly menu) print in one row
 * per meal time, joined with "OR" / "+". Otherwise, Tabular: one row per option
 * ("Option 1: ...", "Option 2: ..."); Open: one row per meal time with the
 * options on separate lines, since that layout groups rows by meal time.
 */
export const toDocumentDays = (days: ManualPlanDay[], format: DietDocumentFormat): DietDocumentDay[] =>
  days.map((d) => {
    const meals: DietDocumentMeal[] = [];
    for (const m of filled(d.meals)) {
      const base = { period: m.time, time: m.at?.trim() || '', note: m.note?.trim() || undefined };
      if (usesLabels(m.options)) {
        meals.push({ ...base, menu: optionsToMenuText(m.options) });
        continue;
      }
      const texts = m.options.map((o, i) => optionLabel(m.options, i, o.text.trim()));
      if (format === 'open') meals.push({ ...base, menu: texts.join('\n') });
      else texts.forEach((menu, i) => meals.push({ ...base, menu, note: i === texts.length - 1 ? base.note : undefined }));
    }
    const notes = toBulletList(d.notes);
    if (d.calories > 0) notes.push(`Approx. calories for the day: ${Math.round(d.calories)} kcal`);
    return { label: d.label, meals, notes };
  });

const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const withoutNotes = (s: string) => normalize(s.replace(/\(.*?\)/g, ''));

/** Recipe bank entries whose name exactly matches a meal in the plan (bracketed notes ignored). */
export const fetchRecipesForMeals = async (days: ManualPlanDay[]): Promise<DietDocumentRecipe[]> => {
  const wanted = new Set<string>();
  days.forEach((d) =>
    filled(d.meals).forEach((m) =>
      m.options.forEach((o) => {
        wanted.add(normalize(o.text));
        wanted.add(withoutNotes(o.text));
        if (o.recipe) wanted.add(normalize(o.recipe));
      }),
    ),
  );
  wanted.delete('');
  if (!wanted.size) return [];
  type RecipeRow = { Meal_name: string; meal_name_normalized: string; Ingredients: string; Instructions: string; Remarks: string; recipe_links: string[] | null };
  let data: RecipeRow[];
  try {
    data = await fetchAllMealRecipes<RecipeRow>('Meal_name, meal_name_normalized, Ingredients, Instructions, Remarks, recipe_links');
  } catch {
    return [];
  }
  const seen = new Set<string>();
  return data
    .filter((r) => wanted.has(r.meal_name_normalized) || wanted.has(withoutNotes(r.Meal_name)))
    .filter((r) => !seen.has(r.meal_name_normalized) && seen.add(r.meal_name_normalized))
    .map((r) => ({
      name: r.Meal_name,
      ingredients: r.Ingredients || '',
      instructions: r.Instructions || '',
      remarks: r.Remarks || '',
      links: r.recipe_links || [],
    }));
};

interface ClientLike {
  name?: string | null;
  weight?: number | null;
  goal?: string | null;
  diet_preference?: string | null;
  health_conditions?: string[] | null;
}

const todayIso = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** Opens the print / save-as-PDF dialog for a manual plan. Returns false if pop-ups are blocked. */
export const printManualDietPlan = async (opts: {
  format: DietDocumentFormat;
  planName: string;
  client: ClientLike | null | undefined;
  generalInstructions: string;
  days: ManualPlanDay[];
  startDate?: string;
  sessionNo?: number | string;
  /** Diet guidelines appended after the plan. */
  guidelines?: { title: string; html: string }[];
}) => {
  const clientName = opts.client?.name || '';
  const header = {
    ...getDefaultDocumentHeader({}, opts.client, {
      startDate: opts.startDate || todayIso(),
      dayCount: opts.days.length,
      sessionNo: opts.sessionNo,
    }),
    thingsToRemember: toBulletList(opts.generalInstructions),
  };
  return printDietPlan({
    format: opts.format,
    documentTitle: `${opts.planName} - ${clientName}`,
    clientName,
    header,
    dietTitle: opts.planName,
    days: toDocumentDays(opts.days, opts.format),
    recipes: await fetchRecipesForMeals(opts.days),
    guidelines: opts.guidelines,
  });
};

/** An entry in the planner's meal list: a clinic meal name and/or a recipe bank dish. */
export interface MealChoice {
  /** What goes on the plan. */
  text: string;
  /** Recipe bank dish (full name) when there is one — its recipe and video go in the PDF. */
  recipe: string | null;
}

const stripNotes = (s: string) => s.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The clinic's meal names merged with the recipe bank, one entry per dish. A
 * meal name that is also a recipe (same name, ignoring case, punctuation and
 * bracketed notes) takes the recipe's name and link, so the PDF menu links to it.
 */
export const buildMealChoices = (mealNames: string[], recipeNames: string[]): MealChoice[] => {
  const recipeByKey = new Map<string, string>();
  for (const r of recipeNames) {
    const key = normalize(r);
    if (key && !recipeByKey.has(key)) recipeByKey.set(key, r);
  }
  for (const r of recipeNames) {
    const key = withoutNotes(r);
    if (key.length >= 3 && !recipeByKey.has(key)) recipeByKey.set(key, r);
  }

  const choices = new Map<string, MealChoice>();
  const add = (choice: MealChoice) => {
    const key = normalize(choice.text);
    if (key && !choices.has(key)) choices.set(key, choice);
  };
  const fromRecipe = (recipe: string): MealChoice => ({ text: stripNotes(recipe) || recipe, recipe });

  for (const name of mealNames) {
    const recipe = recipeByKey.get(normalize(name)) ?? recipeByKey.get(withoutNotes(name));
    add(recipe ? fromRecipe(recipe) : { text: sentenceCase(name.trim()), recipe: null });
  }
  for (const r of recipeNames) add(fromRecipe(r));

  return [...choices.values()].sort((a, b) => a.text.localeCompare(b.text));
};

// ---------------------------------------------------------------------------
// Loading a diet chart template into the manual planner
// ---------------------------------------------------------------------------

export interface TemplateLike {
  name: string;
  instructions: string | null;
  template_data: {
    day: string;
    meals: {
      time: string;
      clock?: string;
      meal: string;
      alternatives: string;
      notes: string;
      servingUnit?: string;
      servingQty?: number;
      servingHidden?: boolean;
    }[];
  }[];
}

export interface PlannerFromTemplate {
  /** 'weekly' when the template is one menu for the whole week (no weekday). */
  layout: 'days' | 'weekly';
  mealTimes: string[];
  /** Clock time per meal time (from a template imported from a plan), e.g. "10.00 am". */
  mealClocks: Record<string, string>;
  days: { day: string; meals: Record<string, ManualMealOption[]>; notes: Record<string, string>; instructions: string }[];
  instructions: string;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Weekly-menu text -> options: blocks before a "+" line are had with every
 * option (ALWAYS_TAG); the rest are split on "OR" lines, and a leading
 * "2/WEEK:" / "THU (fast day):" style label becomes the option's tag.
 */
export const parseMenuText = (text: string): { text: string; tag: string | null }[] => {
  const segments: string[][] = [[]];
  for (const line of (text || '').split(/\r?\n/)) {
    if (line.trim() === '+') segments.push([]);
    else segments[segments.length - 1].push(line);
  }
  const toOption = (raw: string, tag: string | null = null) => {
    const t = raw.replace(/\s+/g, ' ').trim();
    const m = t.match(OPTION_TAG);
    return m && /[A-Z]/.test(m[1]) ? { text: m[2].trim(), tag: m[1].trim() } : { text: t, tag };
  };
  const out: { text: string; tag: string | null }[] = [];
  segments.slice(0, -1).forEach((seg) => out.push(toOption(seg.join(' '), ALWAYS_TAG)));
  const last = segments[segments.length - 1];
  const options: string[][] = [[]];
  for (const line of last) {
    if (/^\s*or\s*$/i.test(line)) options.push([]);
    else options[options.length - 1].push(line);
  }
  options.forEach((o) => out.push(toOption(o.join(' '))));
  return out.filter((o) => o.text && o.text !== '-');
};

export const templateToPlanner = (
  template: TemplateLike,
  lookups: { optionIdByName: Map<string, string>; recipeByName: Map<string, string> },
): PlannerFromTemplate => {
  const mealTimes: string[] = [];
  const mealClocks: Record<string, string> = {};
  const seenTimes = new Set<string>();
  const withLookups = (text: string, tag: string | null, serving = ''): ManualMealOption => {
    const key = normalize(text);
    return {
      text: serving ? `${text} (${serving})` : text,
      tag,
      optionId: lookups.optionIdByName.get(key) ?? null,
      recipe: lookups.recipeByName.get(key) ?? lookups.recipeByName.get(withoutNotes(text)) ?? null,
    };
  };

  const days = (template.template_data || []).map((d, index) => {
    const meals: Record<string, ManualMealOption[]> = {};
    const notes: Record<string, string> = {};
    for (const m of d.meals || []) {
      const time = (m.time || '').trim() || 'Meal';
      if (!seenTimes.has(time.toLowerCase())) {
        seenTimes.add(time.toLowerCase());
        mealTimes.push(time);
      }
      const canonical = mealTimes.find((t) => t.toLowerCase() === time.toLowerCase())!;
      if (m.clock?.trim() && !mealClocks[canonical]) mealClocks[canonical] = m.clock.trim();
      const serving = m.servingHidden ? '' : formatServing(m.servingUnit, m.servingQty);
      const main = parseMenuText(m.meal || '').map((o, i) => withLookups(o.text, o.tag, i === 0 && !o.tag ? serving : ''));
      // Alternatives: weekly-menu text, or one alternative per line ("OR ..." allowed).
      const alts = /^\s*or\s*$/im.test(m.alternatives || '') || (m.alternatives || '').includes('\n+\n')
        ? parseMenuText(m.alternatives || '')
        : (m.alternatives || '').split(/\r?\n/).map((alt) => parseMenuText(alt.replace(/^\s*(?:or\b|[-•*])\s*/i, ''))[0]).filter(Boolean);
      const options = [...main, ...alts.map((o) => withLookups(o!.text, o!.tag))].filter((o) => o.text && o.text !== '-');
      if (options.length) meals[canonical] = [...(meals[canonical] ?? []), ...options];
      if (m.notes?.trim()) notes[canonical] = [notes[canonical], m.notes.trim()].filter(Boolean).join('\n');
    }
    const weekday = WEEKDAYS.find((w) => (d.day || '').toLowerCase().includes(w.toLowerCase()));
    return { day: weekday ?? WEEKDAYS[index % 7], meals, notes, instructions: '' };
  });

  const only = template.template_data?.length === 1 ? template.template_data[0] : null;
  const layout = only && !WEEKDAYS.some((w) => (only.day || '').toLowerCase().includes(w.toLowerCase())) ? 'weekly' : 'days';
  return { layout, mealTimes, mealClocks, days, instructions: template.instructions?.trim() || '' };
};
