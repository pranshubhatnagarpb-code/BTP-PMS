import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, ChevronRight, Mail, Plus, Trash2, ClipboardList, FilePlus, ArrowUp, ArrowDown, X, Clock, BookTemplate } from 'lucide-react';
import { useDietOptions, useMealRecipeNames } from '@/hooks/useDietOptions';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateDietPlan } from '@/hooks/useDietPlans';
import { toast } from 'sonner';
import { AIDietPlanGenerator } from '@/components/diet/AIDietPlanGenerator';
import SavedDietPlans from '@/components/diet/SavedDietPlans';
import { type DietDocumentFormat } from '@/lib/dietPlanDocument';
import { DietPlanDownloadMenu } from '@/components/diet/DietPlanDownloadMenu';
import { MealPicker } from '@/components/diet/MealPicker';
import { OptionTagPicker } from '@/components/diet/OptionTagPicker';
import { GuidelinePicker } from '@/components/diet/GuidelinePicker';
import { pickGuidelines, useDietGuidelines, type GuidelineEdits } from '@/hooks/useDietGuidelines';
import { DietTemplatePickerDialog } from '@/components/diet/DietTemplatePickerDialog';
import type { DietChartTemplate } from '@/hooks/useDietChartTemplates';
import { useAddMealNames, useMealNames } from '@/hooks/useMealNames';
import {
  DEFAULT_MEAL_TIMES,
  LEGACY_MEAL_COLUMNS,
  buildMealChoices,
  templateToPlanner,
  dayCalories,
  hasAnyMeal,
  legacyMealKey,
  printManualDietPlan,
  WEEKLY_MENU_LABEL,
  type ManualMealOption,
  type ManualMealTime,
  type ManualPlanDay,
} from '@/lib/manualDietPlan';

// Meal times apply to every day. Days keep their meals by meal-time id, so a
// meal time can be renamed or reordered without losing what was picked.
interface MealTime {
  id: string;
  name: string;
  /** Clock time for the PDF's TIME column, e.g. "10.00 am". */
  at?: string;
}

interface DayPlan {
  id: string;
  day: string;
  meals: Record<string, ManualMealOption[]>;
  /** Full-width note under a meal (by meal-time id), e.g. "Walk 10-15 mins post lunch". */
  notes: Record<string, string>;
  instructions: string;
}

// 'weekly' = one menu for the whole week, options labelled 2/WEEK, THU (fast day)...
// (the clinic's format, as in Ishwari's plan); 'days' = a menu per day.
type PlanLayout = 'weekly' | 'days';
const LAYOUT_STORAGE_KEY = 'manual_diet_layout';
const loadLayout = (): PlanLayout => {
  try {
    return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'days' ? 'days' : 'weekly';
  } catch {
    return 'weekly';
  }
};

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Kept across plans (and page reloads) so the clinic's usual meal times stay set up.
const MEAL_TIMES_STORAGE_KEY = 'manual_diet_meal_times';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const loadMealTimes = (): MealTime[] => {
  try {
    const saved = JSON.parse(localStorage.getItem(MEAL_TIMES_STORAGE_KEY) || 'null');
    if (Array.isArray(saved) && saved.length && saved.every((m) => typeof m?.id === 'string' && typeof m?.name === 'string')) {
      return saved;
    }
  } catch {
    // ignore unreadable storage
  }
  return DEFAULT_MEAL_TIMES.map((name) => ({ id: newId(), name }));
};

const emptyDay = (day = 'Monday'): DayPlan => ({ id: newId(), day, meals: {}, notes: {}, instructions: '' });

const DietSection = () => {
  const [activeTab, setActiveTab] = useState('create');
  const [selectedClient, setSelectedClient] = useState('');
  const [planName, setPlanName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [mealTimes, setMealTimes] = useState<MealTime[]>(loadMealTimes);
  const [newMealTime, setNewMealTime] = useState('');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([emptyDay()]);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  // Diet guidelines appended to this plan's PDF.
  const [guidelineIds, setGuidelineIds] = useState<string[]>([]);
  // This plan's own edits to those guidelines (the library copy is untouched).
  const [guidelineEdits, setGuidelineEdits] = useState<GuidelineEdits>({});
  const { guidelines: allGuidelines } = useDietGuidelines();
  const [layout, setLayout] = useState<PlanLayout>(loadLayout);
  const weekly = layout === 'weekly';
  // Notes under meals that have been opened for editing (or have text).
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

  const { data: dietOptions = [], isLoading: optionsLoading } = useDietOptions();
  const { data: recipeNames = [] } = useMealRecipeNames();
  // Master meal list (clinic meal names + meals typed in earlier plans).
  const { names: masterMealNames, tableMissing: mealNamesMissing } = useMealNames();
  const addMealNames = useAddMealNames();
  const { data: clients = [], isLoading: clientsLoading } = useActiveClients();
  const createDietPlan = useCreateDietPlan();

  // Load active tab from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('diet_section_active_tab');
    if (savedTab) {
      setActiveTab(savedTab);
    }
  }, []);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('diet_section_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {
      // ignore
    }
  }, [layout]);

  // Weekly menu: a single menu for the whole week. Switching keeps the first day.
  const switchLayout = (next: PlanLayout) => {
    if (next === layout) return;
    if (next === 'weekly' && dayPlans.length > 1) {
      const others = dayPlans.slice(1).some((d) => Object.values(d.meals).some((o) => o.some((x) => x.text.trim())));
      if (others && !window.confirm('A weekly menu has one menu for the whole week. Keep Day 1 and remove the other days?')) return;
      setDayPlans([dayPlans[0]]);
    }
    setLayout(next);
  };

  useEffect(() => {
    try {
      localStorage.setItem(MEAL_TIMES_STORAGE_KEY, JSON.stringify(mealTimes));
    } catch {
      // storage unavailable — meal times just won't be remembered
    }
  }, [mealTimes]);

  // Clinic meal names + recipe bank, one entry per dish (recipes keep their link).
  const mealChoices = useMemo(() => buildMealChoices(masterMealNames, recipeNames), [masterMealNames, recipeNames]);

  // Meals typed by hand that aren't a meal name, recipe or meal option yet.
  const newTypedMeals = (planDaysToSave: ManualPlanDay[]) => {
    const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const known = new Set([...mealChoices.map((c) => key(c.text)), ...recipeNames.map(key), ...dietOptions.map((o) => key(o.name))]);
    const found = new Map<string, string>();
    planDaysToSave.forEach((d) =>
      d.meals.forEach((m) =>
        m.options.forEach((o) => {
          const k = key(o.text);
          if (!o.optionId && !o.recipe && k && !known.has(k) && !found.has(k)) found.set(k, o.text.replace(/\s+/g, ' ').trim());
        }),
      ),
    );
    return [...found.values()];
  };

  // Fills the planner from a diet chart template: its meal times, days, meals
  // (alternatives as extra options), notes and instructions.
  const applyTemplate = (template: DietChartTemplate) => {
    const hasMeals = dayPlans.some((d) => Object.values(d.meals).some((opts) => opts.some((o) => o.text.trim())));
    if (hasMeals && !window.confirm(`Replace the current days and meals with "${template.name}"?`)) return;

    const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const optionIdByName = new Map(dietOptions.map((o) => [key(o.name), o.id]));
    const recipeByName = new Map<string, string>();
    mealChoices.forEach((c) => c.recipe && recipeByName.set(key(c.text), c.recipe));
    recipeNames.forEach((r) => recipeByName.set(key(r), r));

    const converted = templateToPlanner(template, { optionIdByName, recipeByName });
    if (!converted.days.length) {
      toast.error('This template has no days');
      return;
    }
    const times = (converted.mealTimes.length ? converted.mealTimes : DEFAULT_MEAL_TIMES).map((name) => ({
      id: newId(),
      name,
      ...(converted.mealClocks[name] ? { at: converted.mealClocks[name] } : {}),
    }));
    const idByName = new Map(times.map((t) => [t.name, t.id]));
    setMealTimes(times);
    setLayout(converted.layout);
    setDayPlans(
      converted.days.map((d) => ({
        id: newId(),
        day: d.day,
        instructions: d.instructions,
        meals: Object.fromEntries(Object.entries(d.meals).map(([time, opts]) => [idByName.get(time)!, opts])),
        notes: Object.fromEntries(Object.entries(d.notes).map(([time, note]) => [idByName.get(time)!, note])),
      })),
    );
    if (!planName.trim()) setPlanName(template.name);
    if (!generalInstructions.trim() && converted.instructions) setGeneralInstructions(converted.instructions);
    setTemplatePickerOpen(false);
    toast.success(
      converted.layout === 'weekly'
        ? `Loaded "${template.name}" as a weekly menu`
        : `Loaded "${template.name}" — ${converted.days.length} day${converted.days.length === 1 ? '' : 's'}`,
    );
  };

  const caloriesById = useMemo(() => new Map(dietOptions.map((o) => [o.id, o.calories])), [dietOptions]);

  // Breakfast / Lunch / Snacks / Dinner offer their own meal options; other meal times offer all.
  const optionsFor = (mealTimeName: string) => {
    const key = legacyMealKey(mealTimeName);
    return key ? dietOptions.filter((o) => o.meal_type === key) : dietOptions;
  };

  // ---- meal times ----
  const addMealTime = () => {
    const name = newMealTime.trim();
    if (!name) return;
    setMealTimes((list) => [...list, { id: newId(), name }]);
    setNewMealTime('');
  };
  const renameMealTime = (id: string, name: string) =>
    setMealTimes((list) => list.map((m) => (m.id === id ? { ...m, name } : m)));
  const setMealTimeAt = (id: string, at: string) =>
    setMealTimes((list) => list.map((m) => (m.id === id ? { ...m, at } : m)));
  const moveMealTime = (index: number, dir: -1 | 1) =>
    setMealTimes((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const removeMealTime = (id: string) => {
    if (mealTimes.length <= 1) return;
    setMealTimes((list) => list.filter((m) => m.id !== id));
  };

  // ---- days ----
  const addDayPlan = () => setDayPlans((list) => [...list, emptyDay()]);
  const removeDayPlan = (id: string) => {
    if (dayPlans.length > 1) setDayPlans((list) => list.filter((plan) => plan.id !== id));
  };
  const updateDay = (id: string, patch: Partial<DayPlan>) =>
    setDayPlans((list) => list.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));

  const optionsOf = (plan: DayPlan, mealTimeId: string): ManualMealOption[] =>
    plan.meals[mealTimeId]?.length ? plan.meals[mealTimeId] : [{ text: '', optionId: null }];

  const setOption = (plan: DayPlan, mealTimeId: string, index: number, value: ManualMealOption) => {
    const options = [...optionsOf(plan, mealTimeId)];
    options[index] = value;
    updateDay(plan.id, { meals: { ...plan.meals, [mealTimeId]: options } });
  };
  const addOption = (plan: DayPlan, mealTimeId: string) =>
    updateDay(plan.id, { meals: { ...plan.meals, [mealTimeId]: [...optionsOf(plan, mealTimeId), { text: '', optionId: null }] } });
  const removeOption = (plan: DayPlan, mealTimeId: string, index: number) =>
    updateDay(plan.id, { meals: { ...plan.meals, [mealTimeId]: optionsOf(plan, mealTimeId).filter((_, i) => i !== index) } });
  const setMealNote = (plan: DayPlan, mealTimeId: string, note: string) =>
    updateDay(plan.id, { notes: { ...plan.notes, [mealTimeId]: note } });

  // The planner's state in the shape saved / printed (empty options and meal times dropped).
  const toMealTimes = (plan: DayPlan): ManualMealTime[] =>
    mealTimes
      .map((mt) => ({
        time: mt.name.trim(),
        at: mt.at?.trim() || undefined,
        note: plan.notes?.[mt.id]?.trim() || undefined,
        options: optionsOf(plan, mt.id)
          .filter((o) => o.text.trim())
          .map((o) => ({
            text: o.text.trim(),
            optionId: o.optionId || null,
            recipe: o.recipe || null,
            // Labels belong to the weekly menu layout.
            tag: weekly ? o.tag?.trim() || null : null,
          })),
      }))
      .filter((m) => m.time && m.options.length);

  const planDays = (): ManualPlanDay[] =>
    dayPlans.map((plan) => {
      const meals = toMealTimes(plan);
      return { label: weekly ? WEEKLY_MENU_LABEL : plan.day, meals, notes: plan.instructions, calories: dayCalories(meals, caloriesById) };
    });

  const savePlan = async () => {
    if (!selectedClient || !planName.trim()) {
      toast.error('Please select client and enter plan name');
      return;
    }
    const daysToSave = planDays();
    if (!hasAnyMeal(daysToSave)) {
      toast.error('Add at least one meal');
      return;
    }

    await createDietPlan.mutateAsync({
      client_id: selectedClient,
      plan_name: planName.trim(),
      instructions: generalInstructions,
      guideline_ids: guidelineIds,
      guideline_edits: guidelineEdits,
      days: daysToSave.map((d, index) => {
        // Keep the old per-meal columns filled where they apply, for older screens.
        const legacy = { breakfast_option_id: null, lunch_option_id: null, snacks_option_id: null, dinner_option_id: null } as Record<
          (typeof LEGACY_MEAL_COLUMNS)[keyof typeof LEGACY_MEAL_COLUMNS],
          string | null
        >;
        d.meals.forEach((m) => {
          const key = legacyMealKey(m.time);
          const optionId = m.options[0]?.optionId;
          if (key && optionId) legacy[LEGACY_MEAL_COLUMNS[key]] = optionId;
        });
        return {
          day_label: d.label,
          meals: d.meals,
          ...legacy,
          total_calories: d.calories,
          notes: d.notes,
          sort_order: index,
        };
      }),
    });

    // New hand-typed meals join the master list for future plans.
    if (!mealNamesMissing) {
      const newMeals = newTypedMeals(daysToSave);
      if (newMeals.length) addMealNames.mutate(newMeals);
    }

    // Reset the plan; meal times stay for the next one.
    setPlanName('');
    setGeneralInstructions('');
    setGuidelineIds([]);
    setGuidelineEdits({});
    setDayPlans([emptyDay()]);
  };

  const generatePDF = async (format: DietDocumentFormat) => {
    if (!selectedClient || !planName.trim()) {
      toast.error('Please select a client and enter a plan name');
      return;
    }
    const docDays = planDays();
    if (!hasAnyMeal(docDays)) {
      toast.error('Add at least one meal');
      return;
    }
    const opened = await printManualDietPlan({
      format,
      planName: planName.trim(),
      client: clients.find((c) => c.id === selectedClient),
      generalInstructions,
      days: docDays,
      guidelines: pickGuidelines(allGuidelines, guidelineIds, guidelineEdits),
    });
    if (opened) toast.success('PDF generated successfully!');
    else toast.error('Please allow pop-ups to download the PDF');
  };

  const sendEmail = () => {
    if (!selectedClient || !planName) {
      toast.error('Please select client and enter plan name');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    const clientEmail = client?.email || '';
    const subject = encodeURIComponent(`Diet Plan: ${planName} - Bounce The Pound`);
    const body = encodeURIComponent(`Dear ${client?.name || 'Client'},\n\nPlease find attached your personalized diet plan: ${planName}\n\nBest regards,\nBounce The Pound\nSustainable Weight Loss`);

    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
    toast.success('Email client opened!');
  };

  if (optionsLoading || clientsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Diet Section</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Diet Section</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <FilePlus className="h-4 w-4" /> Create Plan
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Saved Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <div className="flex justify-end gap-2 mb-6">
            <DietPlanDownloadMenu variant="outline" onDownload={generatePDF} />
            <Button variant="outline" onClick={sendEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Email PDF
            </Button>
            <Button onClick={savePlan} disabled={createDietPlan.isPending} className="gradient-primary text-primary-foreground">
              {createDietPlan.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>

          {/* AI Diet Plan Generator */}
          <AIDietPlanGenerator clients={clients} />

          {/* Client & Plan Info */}
          <Card className="p-6 mb-6 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">Manual Diet Planner</h3>
              <Button variant="outline" onClick={() => setTemplatePickerOpen(true)}>
                <BookTemplate className="h-4 w-4 mr-2" />
                Use Diet Chart Template
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No clients yet. Add clients in Clients section first.</div>
                    ) : (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g., Weight Loss Plan - January"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">General Instructions</Label>
                <Input
                  id="instructions"
                  value={generalInstructions}
                  onChange={(e) => setGeneralInstructions(e.target.value)}
                  placeholder="e.g., Drink 8 glasses of water daily"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2 md:max-w-md">
              <Label>Guidelines</Label>
              <GuidelinePicker
                value={guidelineIds}
                onChange={setGuidelineIds}
                edits={guidelineEdits}
                onEditsChange={setGuidelineEdits}
              />
              <p className="text-xs text-muted-foreground">
                Selected guidelines are added to the PDF after the diet plan. Use Edit to change one for this plan only.
              </p>
            </div>
          </Card>

          {/* Meal times — shared by every day */}
          <Card className="p-6 mb-6 shadow-card">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">Meal Times</h3>
              <span className="text-sm text-muted-foreground">— meal type and its time (the PDF's MEAL TYPE and TIME columns)</span>
            </div>
            <div className="space-y-2">
              {mealTimes.map((mt, i) => (
                <div key={mt.id} className="flex items-center gap-2">
                  <Input
                    value={mt.name}
                    onChange={(e) => renameMealTime(mt.id, e.target.value)}
                    className="max-w-xs"
                    placeholder="e.g. Breakfast"
                    aria-label={`Meal type ${i + 1}`}
                  />
                  <Input
                    value={mt.at ?? ''}
                    onChange={(e) => setMealTimeAt(mt.id, e.target.value)}
                    className="w-44"
                    placeholder="Time, e.g. 10.00 am"
                    aria-label={`Time for ${mt.name || `meal ${i + 1}`}`}
                  />
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => moveMealTime(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => moveMealTime(i, 1)}
                    disabled={i === mealTimes.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeMealTime(mt.id)}
                    disabled={mealTimes.length <= 1}
                    aria-label="Remove meal time"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newMealTime}
                onChange={(e) => setNewMealTime(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMealTime()}
                placeholder='e.g. "On rising", "Pre-workout", "Bedtime"'
                className="max-w-sm"
              />
              <Button variant="outline" onClick={addMealTime} disabled={!newMealTime.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add meal time
              </Button>
            </div>
          </Card>

          {/* Layout: weekly menu (clinic format) or a menu per day */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">Layout</span>
            <div className="inline-flex rounded-md border p-0.5">
              <Button size="sm" variant={weekly ? 'default' : 'ghost'} className="h-8" onClick={() => switchLayout('weekly')}>
                Weekly menu
              </Button>
              <Button size="sm" variant={!weekly ? 'default' : 'ghost'} className="h-8" onClick={() => switchLayout('days')}>
                Day by day
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {weekly
                ? 'One menu for the week — label options 2/WEEK, ON THU, THU (fast day)…; options print with OR between them.'
                : 'A separate menu for each day.'}
            </span>
          </div>

          {/* Day Plans */}
          <div className="space-y-4">
            {dayPlans.map((plan, index) => (
              <Card key={plan.id} className="overflow-hidden shadow-card animate-fade-in">
                {/* Day header: number, weekday, remove */}
                <div className="flex items-center gap-3 border-b bg-muted/40 px-5 py-3">
                  <h3 className="font-semibold text-foreground">{weekly ? 'Weekly menu' : `Day ${index + 1}`}</h3>
                  {!weekly && (
                  <Select value={plan.day} onValueChange={(val) => updateDay(plan.id, { day: val })}>
                    <SelectTrigger className="h-8 w-36 bg-background" aria-label="Day of the week">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  )}
                  {!weekly && dayPlans.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDayPlan(plan.id)}
                      className="ml-auto h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Remove day
                    </Button>
                  )}
                </div>

                {/* One row per meal time: name on the left, its options stacked on the right */}
                <div className="divide-y">
                  {mealTimes.map((mt) => {
                    const options = optionsOf(plan, mt.id);
                    return (
                      <div key={mt.id} className="grid gap-2 px-5 py-3 md:grid-cols-[200px_1fr] md:gap-4">
                        <div className="pt-2">
                          <div className="text-sm font-semibold text-foreground">{mt.name || 'Meal time'}</div>
                          {mt.at && <div className="text-xs text-muted-foreground">{mt.at}</div>}
                        </div>
                        <div className="min-w-0 space-y-2">
                          {options.map((opt, oi) => (
                            <div key={oi} className="flex items-start gap-2">
                              {weekly ? (
                                <OptionTagPicker value={opt.tag} onChange={(tag) => setOption(plan, mt.id, oi, { ...opt, tag })} />
                              ) : (
                                options.length > 1 && (
                                  <span
                                    className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground"
                                    title={`Option ${oi + 1}`}
                                  >
                                    {oi + 1}
                                  </span>
                                )
                              )}
                              <div className="min-w-0 flex-1">
                                <MealPicker
                                  value={opt}
                                  onChange={(v) => setOption(plan, mt.id, oi, { ...v, tag: opt.tag })}
                                  mealOptions={optionsFor(mt.name)}
                                  choices={mealChoices}
                                  placeholder={`Pick or type ${mt.name ? mt.name.toLowerCase() : 'a meal'}`}
                                />
                              </div>
                              {(options.length > 1 || opt.text) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    options.length > 1 ? removeOption(plan, mt.id, oi) : setOption(plan, mt.id, oi, { text: '', optionId: null, recipe: null })
                                  }
                                  aria-label={options.length > 1 ? `Remove option ${oi + 1}` : 'Clear meal'}
                                  title={options.length > 1 ? 'Remove this option' : 'Clear'}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => addOption(plan, mt.id)}
                              className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-primary hover:underline"
                            >
                              <Plus className="h-3.5 w-3.5" /> {weekly ? 'Add option (OR)' : 'Add option'}
                            </button>
                            {!(openNotes[`${plan.id}:${mt.id}`] || plan.notes?.[mt.id]) && (
                              <button
                                type="button"
                                onClick={() => setOpenNotes((o) => ({ ...o, [`${plan.id}:${mt.id}`]: true }))}
                                className="inline-flex items-center gap-1 rounded px-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                              >
                                <Plus className="h-3.5 w-3.5" /> Note under this meal
                              </button>
                            )}
                          </div>
                          {(openNotes[`${plan.id}:${mt.id}`] || plan.notes?.[mt.id]) && (
                            <Input
                              value={plan.notes?.[mt.id] ?? ''}
                              onChange={(e) => setMealNote(plan, mt.id, e.target.value)}
                              placeholder="Full-width note, e.g. PLEASE DO NOT SLEEP/ SIT IMMEDIATELY — WALK FOR 10-15 MINS"
                              className="h-8 text-xs"
                              aria-label={`Note under ${mt.name}`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 border-t px-5 py-4">
                  <Label>{weekly ? 'Instructions for the week' : 'Instructions for this day'}</Label>
                  <Textarea
                    value={plan.instructions}
                    onChange={(e) => updateDay(plan.id, { instructions: e.target.value })}
                    placeholder="Add any special instructions for this day..."
                    rows={2}
                  />
                </div>
              </Card>
            ))}
          </div>

          {!weekly && (
            <Button onClick={addDayPlan} className="mt-4 gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Add Another Day
            </Button>
          )}
        </TabsContent>

        <DietTemplatePickerDialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen} onPick={applyTemplate} />

        <TabsContent value="saved">
          <SavedDietPlans />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DietSection;
