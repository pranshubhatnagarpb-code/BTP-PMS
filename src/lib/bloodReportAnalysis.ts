// AI analysis of blood reports: request building (for the `analyze-blood-report`
// edge function) and conversion of a saved analysis into diet-plan prompt text.
import { BLOOD_MARKERS, getMarkerStatus } from './bloodMarkers';
import type { BloodReport } from '@/hooks/useBloodReports';
import type { Client } from '@/hooks/useClients';

export type FindingStatus = 'low' | 'borderline' | 'normal' | 'high';

export interface BloodReportFinding {
  marker: string;
  value: string;
  status: FindingStatus;
  interpretation: string;
  trend: string | null;
}

export interface BloodReportAnalysis {
  summary: string;
  overallConcern: 'low' | 'moderate' | 'high';
  findings: BloodReportFinding[];
  nutritionPriorities: string[];
  foodsToInclude: string[];
  foodsToLimit: string[];
  supplementConsiderations: string[];
  followUp: string[];
}

const formatRange = (low: number | null, high: number | null) => {
  if (low !== null && high !== null) return `${low}–${high}`;
  if (high !== null) return `< ${high}`;
  if (low !== null) return `> ${low}`;
  return null;
};

const ageFromDob = (dob: string | null | undefined): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
};

export const reportHasValues = (report: BloodReport) =>
  BLOOD_MARKERS.some((m) => typeof report.values?.[m.key] === 'number');

export const buildAnalysisRequest = (
  report: BloodReport,
  previous: BloodReport | null,
  client: Client | null,
) => {
  const markers = BLOOD_MARKERS.flatMap((m) => {
    const value = report.values?.[m.key];
    if (typeof value !== 'number') return [];
    const prev = previous?.values?.[m.key];
    return [{
      label: m.label,
      unit: m.unit,
      value,
      referenceRange: formatRange(m.refLow, m.refHigh),
      status: getMarkerStatus(m.key, value),
      previousValue: typeof prev === 'number' ? prev : null,
    }];
  });

  return {
    reportDate: report.report_date,
    previousReportDate: previous?.report_date ?? null,
    markers,
    notes: report.notes,
    client: client
      ? {
          age: ageFromDob(client.date_of_birth),
          gender: client.gender,
          goal: client.goal,
          healthConditions: client.health_conditions || [],
          dietPreference: client.diet_preference,
        }
      : undefined,
  };
};

const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');

// Compact text version of the analysis passed to the diet plan generator.
export const analysisToPromptText = (analysis: BloodReportAnalysis, reportDate: string): string => {
  const flagged = analysis.findings.filter((f) => f.status !== 'normal');
  const parts = [
    `Blood report dated ${reportDate}. ${analysis.summary}`,
    flagged.length
      ? `Key findings:\n${bullets(flagged.map((f) => `${f.marker}: ${f.value} (${f.status})${f.trend ? ` — ${f.trend}` : ''}`))}`
      : '',
    analysis.nutritionPriorities.length ? `Nutrition priorities:\n${bullets(analysis.nutritionPriorities)}` : '',
    analysis.foodsToInclude.length ? `Foods to include: ${analysis.foodsToInclude.join(', ')}` : '',
    analysis.foodsToLimit.length ? `Foods to limit: ${analysis.foodsToLimit.join(', ')}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
};

export const CONCERN_BADGE_CLASS: Record<BloodReportAnalysis['overallConcern'], string> = {
  low: 'bg-success/15 text-success border-success/30',
  moderate: 'bg-warning/15 text-warning border-warning/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
};

export const FINDING_BADGE_CLASS: Record<FindingStatus, string> = {
  low: 'bg-warning/15 text-warning border-warning/30',
  borderline: 'bg-warning/10 text-warning border-warning/20',
  normal: 'bg-success/15 text-success border-success/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
};
