// Blood marker definitions: labels, units, reference ranges.
// Reference ranges are general adult guidelines used only for low/normal/high flagging in the UI.

export type BloodMarkerKey =
  | 'hemoglobin'
  | 'fasting_blood_sugar'
  | 'postprandial_blood_sugar'
  | 'hba1c'
  | 'total_cholesterol'
  | 'triglycerides'
  | 'hdl'
  | 'ldl'
  | 'vldl'
  | 'vitamin_d'
  | 'vitamin_b12'
  | 'tsh'
  | 'uric_acid'
  | 'creatinine'
  | 'iron'
  | 'ferritin'
  | 'calcium'
  | 'insulin_fasting'
  | 'insulin_post_prandial'
  | 'homocysteine'
  | 'homo_ir'
  | 'esr';

export interface BloodMarkerDef {
  key: BloodMarkerKey;
  label: string;
  unit: string;
  // null on either side = open-ended
  refLow: number | null;
  refHigh: number | null;
  // Aliases used when extracting from raw text
  aliases: string[];
  group: 'Sugar' | 'Lipids' | 'Vitamins' | 'Thyroid' | 'CBC' | 'Kidney' | 'Minerals' | 'Insulin' | 'Inflammation';
}

export const BLOOD_MARKERS: BloodMarkerDef[] = [
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', refLow: 12, refHigh: 17, group: 'CBC', aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'] },
  { key: 'fasting_blood_sugar', label: 'Fasting Blood Sugar', unit: 'mg/dL', refLow: 70, refHigh: 100, group: 'Sugar', aliases: ['fasting blood sugar', 'fasting glucose', 'fbs', 'glucose fasting'] },
  { key: 'postprandial_blood_sugar', label: 'Postprandial Blood Sugar', unit: 'mg/dL', refLow: null, refHigh: 140, group: 'Sugar', aliases: ['postprandial', 'pp blood sugar', 'ppbs', 'glucose pp', 'post prandial'] },
  { key: 'hba1c', label: 'HbA1c', unit: '%', refLow: null, refHigh: 5.7, group: 'Sugar', aliases: ['hba1c', 'hb a1c', 'glycated hemoglobin', 'glycosylated hemoglobin', 'a1c'] },
  { key: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', refLow: null, refHigh: 200, group: 'Lipids', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol'] },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: null, refHigh: 150, group: 'Lipids', aliases: ['triglycerides', 'tg'] },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', refLow: 40, refHigh: null, group: 'Lipids', aliases: ['hdl', 'hdl cholesterol', 'high density'] },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', refLow: null, refHigh: 100, group: 'Lipids', aliases: ['ldl', 'ldl cholesterol', 'low density'] },
  { key: 'vldl', label: 'VLDL', unit: 'mg/dL', refLow: null, refHigh: 30, group: 'Lipids', aliases: ['vldl', 'very low density'] },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', refLow: 30, refHigh: 100, group: 'Vitamins', aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy', 'vit d', '25(oh)d'] },
  { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/mL', refLow: 200, refHigh: 900, group: 'Vitamins', aliases: ['vitamin b12', 'b12', 'cobalamin', 'vit b12'] },
  { key: 'tsh', label: 'TSH', unit: 'µIU/mL', refLow: 0.4, refHigh: 4.5, group: 'Thyroid', aliases: ['tsh', 'thyroid stimulating hormone'] },
  { key: 'uric_acid', label: 'Uric Acid', unit: 'mg/dL', refLow: 3.4, refHigh: 7.0, group: 'Kidney', aliases: ['uric acid'] },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', refLow: 0.6, refHigh: 1.3, group: 'Kidney', aliases: ['creatinine', 'serum creatinine'] },
  { key: 'iron', label: 'Iron', unit: 'µg/dL', refLow: 60, refHigh: 170, group: 'Minerals', aliases: ['iron', 'serum iron'] },
  { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', refLow: 30, refHigh: 400, group: 'Minerals', aliases: ['ferritin'] },
  { key: 'calcium', label: 'Calcium', unit: 'mg/dL', refLow: 8.6, refHigh: 10.3, group: 'Minerals', aliases: ['calcium', 'serum calcium'] },
  { key: 'insulin_fasting', label: 'Insulin Fasting', unit: 'µIU/mL', refLow: 2, refHigh: 25, group: 'Insulin', aliases: ['insulin fasting', 'fasting insulin', 'insulin f', 'f insulin'] },
  { key: 'insulin_post_prandial', label: 'Insulin Post Prandial', unit: 'µIU/mL', refLow: null, refHigh: 60, group: 'Insulin', aliases: ['insulin post prandial', 'post prandial insulin', 'insulin pp', 'pp insulin'] },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', refLow: null, refHigh: 15, group: 'Inflammation', aliases: ['homocysteine', 'hcy'] },
  { key: 'homo_ir', label: 'HOMO IR', unit: '', refLow: null, refHigh: 2.5, group: 'Insulin', aliases: ['homo ir', 'homair', 'insulin resistance'] },
  { key: 'esr', label: 'ESR', unit: 'mm/hr', refLow: null, refHigh: 20, group: 'Inflammation', aliases: ['esr', 'erythrocyte sedimentation rate', 'sedimentation rate'] },
];

export const BLOOD_MARKER_MAP: Record<BloodMarkerKey, BloodMarkerDef> =
  BLOOD_MARKERS.reduce((acc, m) => { acc[m.key] = m; return acc; }, {} as Record<BloodMarkerKey, BloodMarkerDef>);

export type MarkerStatus = 'low' | 'normal' | 'high' | 'unknown';

export const getMarkerStatus = (key: BloodMarkerKey, value: number | null | undefined): MarkerStatus => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const def = BLOOD_MARKER_MAP[key];
  if (!def) return 'unknown';
  if (def.refLow !== null && value < def.refLow) return 'low';
  if (def.refHigh !== null && value > def.refHigh) return 'high';
  return 'normal';
};

export const STATUS_BADGE_CLASS: Record<MarkerStatus, string> = {
  low: 'bg-warning/15 text-warning border-warning/30',
  normal: 'bg-success/15 text-success border-success/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};
