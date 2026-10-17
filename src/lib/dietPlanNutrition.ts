// Calls to the diet-plan nutrition edge functions, shared by the diet chart
// editor (auto-check after generating) and the AI Nutrition Analysis dialog.
//   analyze-diet-macros — per-meal calorie / macro estimates (totals summed here)
//   adjust-diet-plan    — resizes portions so each day meets the client's targets
import { differenceInYears, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type { Client } from '@/hooks/useClients';
import { type NutritionTargets, compareToTarget, targetsToPromptText } from '@/lib/nutritionTargets';

export interface AnalysisDayInput {
  label: string;
  meals: { period: string; time: string; foodPlan: string }[];
}

export interface MealEstimate {
  period: string;
  food: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  assumptions: string | null;
}

export type Totals = Pick<MealEstimate, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g'>;

export interface DayAnalysis {
  label: string;
  meals: MealEstimate[];
  totals: Totals;
}

export interface PlanAnalysis {
  days: DayAnalysis[];
  observations: string[];
  suggestions: string[];
}

export const ZERO_TOTALS: Totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 };

export const sumTotals = (items: Totals[]): Totals =>
  items.reduce((t, m) => ({
    calories: t.calories + (m.calories || 0),
    protein_g: t.protein_g + (m.protein_g || 0),
    carbs_g: t.carbs_g + (m.carbs_g || 0),
    fat_g: t.fat_g + (m.fat_g || 0),
    fiber_g: t.fiber_g + (m.fiber_g || 0),
  }), ZERO_TOTALS);

// Supabase puts a function's own error message in the response body.
const invoke = async <T,>(name: string, body: unknown): Promise<T> => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
};

const clientContext = (client?: Client | null) =>
  client
    ? {
        gender: client.gender,
        age: client.date_of_birth ? differenceInYears(new Date(), parseISO(client.date_of_birth)) : null,
        weight_kg: client.weight,
        height_cm: client.height,
        goal: client.goal,
        diet_preference: client.diet_preference,
        health_conditions: client.health_conditions,
      }
    : undefined;

// Empty meals and days are skipped; the result's days line up with the
// non-empty days that were sent.
export const nonEmptyDays = (days: AnalysisDayInput[]) =>
  days
    .map((d) => ({ ...d, meals: d.meals.filter((m) => m.foodPlan.trim()) }))
    .filter((d) => d.meals.length > 0);

// Identifies the chart an analysis was made for (meals + serving size), so a
// summary saved on the plan can be recognised as out of date after edits.
export const chartSignature = (days: AnalysisDayInput[], servingSize?: string) =>
  JSON.stringify({ days: nonEmptyDays(days), servingSize: servingSize ?? '' });

// The part of an analysis shown to the client in the plan PDF: daily totals and
// the average only — no targets, flags or dietitian notes. Saved on the plan.
export interface ClientNutritionSummary {
  chartSignature: string;
  analyzedAt: string; // ISO
  days: { label: string; totals: Totals }[];
  average: Totals;
}

export const toClientNutritionSummary = (
  analysis: PlanAnalysis,
  signature: string,
  analyzedAt: Date,
): ClientNutritionSummary => {
  const totals = analysis.days.map((d) => d.totals);
  const sum = sumTotals(totals);
  const n = Math.max(totals.length, 1);
  return {
    chartSignature: signature,
    analyzedAt: analyzedAt.toISOString(),
    days: analysis.days.map((d) => ({ label: d.label, totals: d.totals })),
    average: {
      calories: sum.calories / n,
      protein_g: sum.protein_g / n,
      carbs_g: sum.carbs_g / n,
      fat_g: sum.fat_g / n,
      fiber_g: sum.fiber_g / n,
    },
  };
};

export const analyzeDietDays = async (
  days: AnalysisDayInput[],
  servingSize?: string,
  client?: Client | null,
): Promise<PlanAnalysis> => {
  // Targets are deliberately not sent: they bias the estimates towards them.
  const data = await invoke<{ days: { label: string; meals: MealEstimate[] }[]; observations: string[]; suggestions: string[] }>(
    'analyze-diet-macros',
    { days, servingSize, client: clientContext(client) },
  );
  return {
    ...data,
    days: data.days.map((d) => ({ ...d, totals: sumTotals(d.meals) })),
  };
};

// A day needs adjusting when calories, protein or fat are outside the targets.
export const dayIsOffTarget = (totals: Totals, targets: NutritionTargets) =>
  compareToTarget(totals.calories, targets.ranges.calories) !== 'ok' ||
  compareToTarget(totals.protein_g, targets.ranges.protein_g) !== 'ok' ||
  compareToTarget(totals.fat_g, targets.ranges.fat_g) !== 'ok';

// Re-estimating the same menu varies by roughly ±8%, so after an adjustment a day
// within this margin of its ranges counts as close enough; chasing smaller gaps
// just makes the plan swing back and forth.
const CLOSE_ENOUGH = 0.07;
const near = (value: number, range: { min: number; max: number }) =>
  value >= range.min * (1 - CLOSE_ENOUGH) && value <= range.max * (1 + CLOSE_ENOUGH);
const dayIsClearlyOff = (totals: Totals, targets: NutritionTargets) =>
  !near(totals.calories, targets.ranges.calories) ||
  !near(totals.protein_g, targets.ranges.protein_g) ||
  !near(totals.fat_g, targets.ranges.fat_g);

export interface AdjustDayInput {
  label: string;
  meals: { period: string; time: string; foodPlan: string; alternative: string }[];
}

export interface AdjustedPlan {
  dayGroups: { label: string; meals: { period: string; foodPlan: string; alternative: string }[] }[];
  changes: string[];
}

// What each day needs to reach the middle of the targets, e.g.
// "Calories: add ~240 kcal · Protein: add ~46 g · Fat: on target".
export const dayGap = (totals: Totals, targets: NutritionTargets) => {
  const part = (label: string, value: number, key: 'calories' | 'protein_g' | 'fat_g', unit: string) => {
    const range = targets.ranges[key];
    if (compareToTarget(value, range) === 'ok') return `${label}: on target`;
    const diff = Math.round((range.min + range.max) / 2 - value);
    return `${label}: ${diff > 0 ? 'add' : 'cut'} ~${Math.abs(diff)}${unit}`;
  };
  return [
    part('Calories', totals.calories, 'calories', ' kcal'),
    part('Protein', totals.protein_g, 'protein_g', ' g'),
    part('Fat', totals.fat_g, 'fat_g', ' g'),
  ].join(' · ');
};

// `analysis` must line up day-for-day and meal-for-meal with `dayGroups`.
export const adjustDietPlan = (
  dayGroups: AdjustDayInput[],
  analysis: DayAnalysis[],
  targets: NutritionTargets,
  servingSize?: string,
  client?: Client | null,
) =>
  invoke<AdjustedPlan>('adjust-diet-plan', {
    dayGroups,
    analysis,
    gaps: analysis.map((a) => (dayIsOffTarget(a.totals, targets) ? dayGap(a.totals, targets) : 'fully on target — leave unchanged')),
    targets: targetsToPromptText(targets),
    servingSize,
    dietPreference: client?.diet_preference ?? undefined,
  });

interface PlanMeal { period: string; time: string; foodPlan: string; alternative: string }
interface PlanLike<M extends PlanMeal> { dayGroups: { label: string; dates?: string; meals: M[] }[] }

const dayLabel = (g: { label: string; dates?: string }) => (g.dates ? `${g.label} (${g.dates})` : g.label);

// The chart's non-empty cells, remembering where each came from.
export const planToAnalysisDays = <M extends PlanMeal>(plan: PlanLike<M>) =>
  plan.dayGroups
    .map((g, dayIdx) => ({
      dayIdx,
      label: dayLabel(g),
      cells: g.meals.map((m, mealIdx) => ({ mealIdx, meal: m })).filter((c) => c.meal.foodPlan.trim()),
    }))
    .filter((d) => d.cells.length > 0);

export interface TargetCheckResult<P> {
  plan: P; // the adjusted plan, or the original when nothing needed changing
  adjusted: boolean;
  offDays: string[]; // days that were outside the targets before adjusting
  changes: string[];
}

// Measures the plan and, when any day is outside the client's targets, has the
// AI resize portions and applies the new meal text — re-measuring and adjusting
// once more if a day is still off. Notes, times and rows are left as they are.
// Pass `analysis` to reuse a fresh analysis of the same plan.
const MAX_ADJUST_ROUNDS = 2;

export const checkPlanAgainstTargets = async <M extends PlanMeal, P extends PlanLike<M>>(
  plan: P,
  targets: NutritionTargets,
  servingSize?: string,
  client?: Client | null,
  analysis?: DayAnalysis[],
): Promise<TargetCheckResult<P>> => {
  let current = plan;
  let firstOffDays: string[] | null = null;
  const changes: string[] = [];

  for (let round = 0; round <= MAX_ADJUST_ROUNDS; round++) {
    const days = planToAnalysisDays(current);
    if (days.length === 0) break;

    const aligned = round === 0 &&
      analysis?.length === days.length && analysis.every((a, i) => a.meals.length === days[i].cells.length);
    const measured = aligned
      ? analysis!
      : (await analyzeDietDays(
          days.map((d) => ({ label: d.label, meals: d.cells.map(({ meal }) => ({ period: meal.period, time: meal.time, foodPlan: meal.foodPlan })) })),
          servingSize,
          client,
        )).days;
    if (measured.length !== days.length || measured.some((a, i) => a.meals.length !== days[i].cells.length)) {
      throw new Error('The nutrition analysis did not match the chart; please try again.');
    }

    const offDays = days.filter((_, i) => dayIsOffTarget(measured[i].totals, targets)).map((d) => d.label);
    firstOffDays ??= offDays;
    // Done when on target — or, after a first adjustment, close enough — or out of rounds.
    const needsWork = round === 0
      ? offDays.length > 0
      : measured.some((m) => dayIsClearlyOff(m.totals, targets));
    if (!needsWork || round === MAX_ADJUST_ROUNDS) break;

    const result = await adjustDietPlan(
      days.map((d) => ({
        label: d.label,
        meals: d.cells.map(({ meal }) => ({ period: meal.period, time: meal.time, foodPlan: meal.foodPlan, alternative: meal.alternative ?? '' })),
      })),
      measured,
      targets,
      servingSize,
      client,
    );
    changes.push(...result.changes);

    const dayGroups = current.dayGroups.map((g) => ({ ...g, meals: [...g.meals] }));
    days.forEach((d, i) => {
      d.cells.forEach(({ mealIdx, meal }, j) => {
        const next = result.dayGroups[i]?.meals[j];
        if (!next?.foodPlan?.trim()) return;
        dayGroups[d.dayIdx].meals[mealIdx] = {
          ...meal,
          foodPlan: next.foodPlan.trim(),
          // An empty alternative stays empty.
          alternative: meal.alternative?.trim() ? next.alternative.trim() || meal.alternative : meal.alternative,
        };
      });
    });
    current = { ...current, dayGroups };
  }

  return { plan: current, adjusted: current !== plan, offDays: firstOffDays ?? [], changes };
};
