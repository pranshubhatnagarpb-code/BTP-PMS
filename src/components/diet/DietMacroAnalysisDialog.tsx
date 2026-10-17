// "AI Nutrition Analysis" for the diet chart editor: snapshots the meals in the
// table at the moment the button is clicked and shows AI-estimated calories and
// macros per meal, per day and on average. Totals are summed here so they always
// add up; the per-meal numbers are estimates from the analyze-diet-macros function.
// Averages and days are flagged against the client's targets (lib/nutritionTargets)
// with the reason for each flag.
import { useState } from 'react';
import { format } from 'date-fns';
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  type MacroKey,
  type NutritionTargets,
  type Range,
  type TargetStatus,
  calculateNutritionTargets,
  compareToTarget,
  missingTargetFields,
  targetReason,
} from '@/lib/nutritionTargets';
import {
  type AnalysisDayInput,
  type ClientNutritionSummary,
  type DayAnalysis,
  type PlanAnalysis,
  type Totals,
  ZERO_TOTALS,
  analyzeDietDays,
  chartSignature,
  dayIsOffTarget,
  nonEmptyDays,
  sumTotals,
  toClientNutritionSummary,
} from '@/lib/dietPlanNutrition';

const METRICS: { key: MacroKey; label: string }[] = [
  { key: 'calories', label: 'Calories' },
  { key: 'protein_g', label: 'Protein' },
  { key: 'carbs_g', label: 'Carbs' },
  { key: 'fat_g', label: 'Fat' },
  { key: 'fiber_g', label: 'Fiber' },
];

const STATUS_STYLES: Record<TargetStatus, { card: string; text: string; label: string }> = {
  ok: { card: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', label: 'On target' },
  low: { card: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', label: 'Low' },
  high: { card: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', label: 'High' },
};

const g = (n: number) => `${Math.round(n)} g`;
const kcal = (n: number) => `${Math.round(n).toLocaleString('en-IN')} kcal`;
// Share of calories: protein & carbs 4 kcal/g, fat 9 kcal/g.
const pct = (grams: number, perGram: number, calories: number) =>
  calories > 0 ? `${Math.round((grams * perGram * 100) / calories)}%` : '–';
const fmt = (key: MacroKey, n: number) => (key === 'calories' ? kcal(n) : g(n));
const fmtRange = (key: MacroKey, r: Range) =>
  key === 'calories'
    ? `${r.min.toLocaleString('en-IN')}–${r.max.toLocaleString('en-IN')} kcal`
    : `${r.min}–${r.max} g`;
// How far outside the range, e.g. "1,530 kcal short".
const gap = (key: MacroKey, value: number, r: Range, status: TargetStatus) => {
  const diff = status === 'low' ? r.min - value : value - r.max;
  return `${fmt(key, diff)} ${status === 'low' ? 'short' : 'over'}`;
};

// Analyses already paid for this session, keyed by exactly what was sent to the AI.
// Module-level so it survives the dialog unmounting (leaving and reopening the editor);
// reopening an unchanged chart shows the saved result instead of calling the AI again.
const analysisCache = new Map<string, { result: PlanAnalysis; analyzedAt: Date }>();
const CACHE_LIMIT = 20;

const cacheKey = (days: AnalysisDayInput[], servingSize?: string, client?: Client | null) =>
  JSON.stringify({
    days,
    servingSize: servingSize ?? '',
    client: client
      ? [client.id, client.gender, client.date_of_birth, client.weight, client.height, client.goal, client.diet_preference]
      : null,
  });

interface Props {
  // Read at click time, so the analysis reflects the table as it is right then.
  getDays: () => AnalysisDayInput[];
  servingSize?: string;
  client?: Client | null;
  // Resizes the plan's portions to the targets using this analysis; resolves
  // true when the plan changed (the analysis is then re-run).
  onAdjust?: (analysis: DayAnalysis[]) => Promise<boolean>;
  // Nutrition summary saved on the plan for the client's PDF (null = not shown).
  // While it's on, each new analysis replaces it so the PDF matches the chart.
  clientSummary?: ClientNutritionSummary | null;
  onClientSummaryChange?: (summary: ClientNutritionSummary | null) => void;
}

export const DietMacroAnalysisDialog = ({ getDays, servingSize, client, onAdjust, clientSummary, onClientSummaryChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [result, setResult] = useState<PlanAnalysis | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const [resultSignature, setResultSignature] = useState('');
  const targets: NutritionTargets | null = calculateNutritionTargets(client);
  const missing = missingTargetFields(client);

  const runAnalysis = async () => {
    const days = nonEmptyDays(getDays());
    if (days.length === 0) {
      toast.error('Add some meals to the diet chart first');
      return;
    }

    const key = cacheKey(days, servingSize, client);
    const signature = chartSignature(days, servingSize);
    const show = (analysis: PlanAnalysis, at: Date) => {
      setResult(analysis);
      setAnalyzedAt(at);
      setResultSignature(signature);
      if (clientSummary && clientSummary.chartSignature !== signature) {
        onClientSummaryChange?.(toClientNutritionSummary(analysis, signature, at));
      }
    };
    const cached = analysisCache.get(key);
    if (cached) {
      // Re-analyze on an unchanged chart: say so rather than silently showing the same result.
      if (open) toast.info("The chart hasn't changed since the last analysis");
      show(cached.result, cached.analyzedAt);
      setOpen(true);
      return;
    }

    setOpen(true);
    setLoading(true);
    setResult(null);
    try {
      const analysis = await analyzeDietDays(days, servingSize, client);
      const at = new Date();
      if (analysisCache.size >= CACHE_LIMIT) analysisCache.delete(analysisCache.keys().next().value!);
      analysisCache.set(key, { result: analysis, analyzedAt: at });
      show(analysis, at);
    } catch (err) {
      toast.error('Nutrition analysis failed', { description: err instanceof Error ? err.message : undefined });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async () => {
    if (!result || !onAdjust) return;
    setAdjusting(true);
    try {
      if (await onAdjust(result.days)) await runAnalysis();
    } finally {
      setAdjusting(false);
    }
  };

  const dayTotals = result?.days.map((d) => d.totals) ?? [];
  const average = dayTotals.length
    ? (Object.fromEntries(
        Object.entries(sumTotals(dayTotals)).map(([k, v]) => [k, v / dayTotals.length]),
      ) as Totals)
    : ZERO_TOTALS;
  const offDayCount = targets ? dayTotals.filter((t) => dayIsOffTarget(t, targets)).length : 0;
  const proteinPerKg = client?.weight ? average.protein_g / client.weight : null;
  const status = (key: MacroKey, value: number): TargetStatus | undefined =>
    targets ? compareToTarget(value, targets.ranges[key]) : undefined;
  const flags = targets
    ? METRICS.map(({ key, label }) => ({ key, label, status: status(key, average[key])! }))
        .filter((f) => f.status !== 'ok')
    : [];
  const hints: Record<MacroKey, string | undefined> = {
    calories: undefined,
    protein_g: `${pct(average.protein_g, 4, average.calories)} kcal${proteinPerKg ? ` · ${proteinPerKg.toFixed(1)} g/kg` : ''}`,
    carbs_g: `${pct(average.carbs_g, 4, average.calories)} kcal`,
    fat_g: `${pct(average.fat_g, 9, average.calories)} kcal`,
    fiber_g: undefined,
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading} title="Estimate calories and macros of the meals in the chart">
        {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />}
        AI Nutrition Analysis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl flex max-h-[90vh] flex-col">
          <DialogHeader>
            <DialogTitle>Nutrition Analysis</DialogTitle>
            <DialogDescription>
              AI estimates for the main meals in the chart{analyzedAt ? ` as of ${format(analyzedAt, 'h:mm a')}` : ''}.
              Alternatives aren't counted. Re-analyze after editing meals; an unchanged chart reuses this result.
            </DialogDescription>
          </DialogHeader>

          {loading || !result ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Analyzing meals…
            </div>
          ) : (
            <div className="-mx-6 space-y-5 overflow-y-auto px-6">
              {/* Daily average */}
              <div>
                <p className="mb-2 text-sm font-medium">
                  Average per day{dayTotals.length > 1 ? ` (across ${dayTotals.length} day plans)` : ''}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {METRICS.map(({ key, label }) => (
                    <Stat
                      key={key}
                      label={label}
                      value={fmt(key, average[key])}
                      hint={hints[key]}
                      status={status(key, average[key])}
                      target={targets ? fmtRange(key, targets.ranges[key]) : undefined}
                    />
                  ))}
                </div>
              </div>

              {/* Target check */}
              {targets ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Check against {targets.goalLabel.toLowerCase()} targets for {client?.name ?? 'this client'}
                  </p>
                  {flags.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> Calories and macros are within the targets for this goal.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {flags.map(({ key, label, status: st }) => (
                        <li key={key} className={cn('rounded-lg border px-3 py-2 text-sm', STATUS_STYLES[st].card)}>
                          <div className={cn('flex items-center gap-1.5 font-medium', STATUS_STYLES[st].text)}>
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {label} {st === 'low' ? 'too low' : 'too high'}: {fmt(key, average[key])} vs target{' '}
                            {fmtRange(key, targets.ranges[key])} ({gap(key, average[key], targets.ranges[key], st)})
                          </div>
                          <p className="mt-0.5 text-muted-foreground">{targetReason(targets, key, st)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {offDayCount > 0 && onAdjust && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {offDayCount} of {dayTotals.length} day{dayTotals.length > 1 ? 's' : ''} outside the calorie, protein or fat
                        targets. AI can resize portions and add items to fix this — you can undo it in the editor.
                      </p>
                      <Button size="sm" onClick={handleAdjust} disabled={adjusting}>
                        {adjusting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />}
                        {adjusting ? 'Adjusting portions…' : 'Adjust plan to targets'}
                      </Button>
                    </div>
                  )}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer select-none">How the targets were calculated</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {targets.basis.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </details>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Add the client's {missing.join(', ')} to compare this plan with their calorie and macro targets.
                </p>
              )}

              {/* Per day, expandable to per meal */}
              <div>
                <p className="mb-1 text-sm font-medium">By day</p>
                <Accordion type="multiple" className="rounded-lg border px-3">
                  {result.days.map((day, i) => (
                    <AccordionItem key={i} value={String(i)} className="last:border-b-0">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline">
                        <div className="flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 pr-3 text-left">
                          <span className="font-medium">{day.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {METRICS.map(({ key, label }, k) => {
                              const st = status(key, dayTotals[i][key]);
                              return (
                                <span key={key}>
                                  {k > 0 && ' · '}
                                  <span
                                    className={cn(st && st !== 'ok' && cn('font-medium', STATUS_STYLES[st].text))}
                                    title={st && st !== 'ok' && targets ? `${STATUS_STYLES[st].label} — target ${fmtRange(key, targets.ranges[key])}` : undefined}
                                  >
                                    {key === 'calories' ? kcal(dayTotals[i][key]) : `${key === 'fiber_g' ? 'Fiber' : label[0]} ${g(dayTotals[i][key])}`}
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[560px] text-xs">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="py-1.5 pr-2 font-medium">Meal</th>
                                <th className="py-1.5 pr-2 text-right font-medium">kcal</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Protein</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Carbs</th>
                                <th className="py-1.5 pr-2 text-right font-medium">Fat</th>
                                <th className="py-1.5 text-right font-medium">Fiber</th>
                              </tr>
                            </thead>
                            <tbody>
                              {day.meals.map((m, j) => (
                                <tr key={j} className="border-b last:border-b-0 align-top">
                                  <td className="py-1.5 pr-2">
                                    <div className="font-medium">{m.period}</div>
                                    <div className="text-muted-foreground">{m.food}</div>
                                    {m.assumptions && <div className="italic text-muted-foreground/80">{m.assumptions}</div>}
                                  </td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums">{Math.round(m.calories)}</td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums">{g(m.protein_g)}</td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums">{g(m.carbs_g)}</td>
                                  <td className="py-1.5 pr-2 text-right tabular-nums">{g(m.fat_g)}</td>
                                  <td className="py-1.5 text-right tabular-nums">{g(m.fiber_g)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>

              {result.observations.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Observations</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.observations.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium">Suggestions</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              <p className="pb-1 text-xs text-muted-foreground">
                Estimates only — actual values vary with recipes, oil and portion sizes.
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {onClientSummaryChange ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Switch
                    checked={!!clientSummary}
                    onCheckedChange={(on) =>
                      onClientSummaryChange(
                        on && analyzedAt ? toClientNutritionSummary(result, resultSignature, analyzedAt) : null,
                      )
                    }
                  />
                  <span>
                    Show nutritional values in client's PDF
                    <span className="block text-xs text-muted-foreground">Daily calories, protein, carbs, fat &amp; fibre — no targets or notes</span>
                  </span>
                </label>
              ) : <span />}
              <Button variant="outline" size="sm" onClick={runAnalysis}>
                <RefreshCw className="h-4 w-4 mr-1" /> Re-analyze current chart
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

const Stat = ({ label, value, hint, status, target }: {
  label: string;
  value: string;
  hint?: string;
  status?: TargetStatus;
  target?: string;
}) => (
  <div className={cn('rounded-lg border px-3 py-2', status ? STATUS_STYLES[status].card : 'bg-muted/30')}>
    <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground">
      {label}
      {status && <span className={cn('font-medium', STATUS_STYLES[status].text)}>{STATUS_STYLES[status].label}</span>}
    </div>
    <div className="text-base font-semibold tabular-nums">{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    {target && <div className="text-[11px] text-muted-foreground">Target {target}</div>}
  </div>
);
