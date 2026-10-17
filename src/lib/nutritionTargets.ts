// Daily calorie and macro targets for a client, from standard formulas:
//   BMR   — Mifflin-St Jeor (age, gender, height, weight)
//   TDEE  — BMR × an activity factor assumed from the goal (no activity data on file)
//   kcal  — TDEE adjusted for the goal (deficit for loss, surplus for gain / muscle)
//   macros — protein in g/kg for the goal, fat and carbs as a share of calories
// Used to brief the AI diet plan generator and to flag the nutrition analysis,
// so both work from the same numbers. These are starting points for the
// dietitian, not prescriptions.

export interface TargetClient {
  gender: string | null;
  date_of_birth: string | null;
  weight: number | null;
  height: number | null;
  goal: string | null;
}

export interface Range {
  min: number;
  max: number;
}

export type MacroKey = 'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g';

export interface NutritionTargets {
  goal: string;
  goalLabel: string;
  bmr: number;
  tdee: number;
  activityLabel: string;
  proteinBasisKg: number;
  ranges: Record<MacroKey, Range>;
  // How the numbers were derived, shown to the dietitian.
  basis: string[];
}

interface GoalRule {
  label: string;
  activity: { factor: number; label: string };
  kcalOffset: Range; // added to TDEE
  proteinPerKg: Range;
  carbsPct: Range; // share of calories
  fatPct: Range;
  why: Record<MacroKey, { low: string; high: string }>;
}

const SEDENTARY_LIGHT = { factor: 1.375, label: 'lightly active (×1.375)' };
const TRAINING = { factor: 1.55, label: 'moderately active / strength training 3–5 days a week (×1.55)' };

const GOAL_RULES: Record<string, GoalRule> = {
  weight_loss: {
    label: 'Weight loss',
    activity: SEDENTARY_LIGHT,
    kcalOffset: { min: -600, max: -400 },
    proteinPerKg: { min: 1.2, max: 1.6 },
    carbsPct: { min: 40, max: 55 },
    fatPct: { min: 20, max: 30 },
    why: {
      calories: {
        low: 'A deficit this deep slows metabolism, costs muscle and is hard to sustain.',
        high: 'Not enough of a calorie deficit for steady fat loss.',
      },
      protein_g: {
        low: 'Too little protein to protect muscle and keep hunger in check during a deficit.',
        high: 'More protein than needed; it crowds out vegetables and fibre without extra benefit.',
      },
      carbs_g: {
        low: 'Very low carbs can cause fatigue and cravings, making the plan hard to follow.',
        high: 'Carbs are taking up calories better used for protein and vegetables.',
      },
      fat_g: {
        low: 'Too little fat affects hormones and absorption of vitamins A, D, E and K.',
        high: 'Fat is calorie-dense; this much makes the deficit hard to keep.',
      },
      fiber_g: {
        low: 'Low fibre reduces fullness and slows digestion.',
        high: 'Very high fibre can cause bloating; increase gradually.',
      },
    },
  },
  weight_gain: {
    label: 'Weight gain',
    activity: TRAINING,
    kcalOffset: { min: 300, max: 500 },
    proteinPerKg: { min: 1.4, max: 1.8 },
    carbsPct: { min: 45, max: 60 },
    fatPct: { min: 20, max: 30 },
    why: {
      calories: {
        low: 'No calorie surplus, so the client will not gain weight.',
        high: 'A surplus this large adds mostly fat rather than lean weight.',
      },
      protein_g: {
        low: 'Too little protein for the gain to be lean mass.',
        high: 'More protein than needed; calories are better spent on carbs for energy.',
      },
      carbs_g: {
        low: 'Too few carbs to fuel training and reach the calorie surplus.',
        high: 'Carbs are crowding out protein and healthy fats.',
      },
      fat_g: {
        low: 'Too little fat; healthy fats are an easy way to add calories.',
        high: 'Too much fat; prefer carbs and protein for quality gain.',
      },
      fiber_g: {
        low: 'Low fibre; add vegetables, fruit and whole grains.',
        high: 'Very high fibre makes it hard to eat enough calories.',
      },
    },
  },
  muscle_building: {
    label: 'Muscle building',
    activity: TRAINING,
    kcalOffset: { min: 250, max: 500 },
    proteinPerKg: { min: 1.6, max: 2.2 },
    carbsPct: { min: 45, max: 60 },
    fatPct: { min: 20, max: 30 },
    why: {
      calories: {
        low: 'Below maintenance plus surplus, so there is not enough energy to build muscle.',
        high: 'A surplus this large adds more fat than muscle.',
      },
      protein_g: {
        low: 'Below 1.6 g/kg, muscle protein synthesis is limited and gains will be slow.',
        high: 'Above ~2.2 g/kg adds no extra muscle; use those calories for carbs to fuel training.',
      },
      carbs_g: {
        low: 'Too few carbs to fuel strength training and recovery.',
        high: 'Carbs are crowding out protein.',
      },
      fat_g: {
        low: 'Too little fat can lower testosterone and hormone production.',
        high: 'Too much fat leaves less room for training carbs and protein.',
      },
      fiber_g: {
        low: 'Low fibre; add vegetables, fruit and whole grains.',
        high: 'Very high fibre makes it hard to eat enough calories.',
      },
    },
  },
  maintain: {
    label: 'Weight maintenance',
    activity: SEDENTARY_LIGHT,
    kcalOffset: { min: -150, max: 150 },
    proteinPerKg: { min: 1.0, max: 1.4 },
    carbsPct: { min: 45, max: 60 },
    fatPct: { min: 20, max: 30 },
    why: {
      calories: {
        low: 'Below maintenance, so the client will slowly lose weight.',
        high: 'Above maintenance, so the client will slowly gain weight.',
      },
      protein_g: {
        low: 'Too little protein to maintain muscle.',
        high: 'More protein than needed for maintenance.',
      },
      carbs_g: {
        low: 'Very low carbs can cause fatigue.',
        high: 'Carbs are crowding out protein and vegetables.',
      },
      fat_g: {
        low: 'Too little fat affects hormones and vitamin absorption.',
        high: 'Too much fat for a balanced maintenance diet.',
      },
      fiber_g: {
        low: 'Low fibre; add vegetables, fruit and whole grains.',
        high: 'Very high fibre can cause bloating.',
      },
    },
  },
};
// Disease management: maintenance targets; the dietitian adjusts for the condition.
GOAL_RULES.disease_management = { ...GOAL_RULES.maintain, label: 'Disease management' };

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const ageFrom = (dob: string) => {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age -= 1;
  return age;
};

// What's missing to compute targets, or an empty list.
export const missingTargetFields = (client: TargetClient | null | undefined) => {
  if (!client) return ['client'];
  return [
    !client.weight && 'weight',
    !client.height && 'height',
    !client.gender && 'gender',
    !client.date_of_birth && 'date of birth',
    !client.goal && 'goal',
  ].filter(Boolean) as string[];
};

export const calculateNutritionTargets = (client: TargetClient | null | undefined): NutritionTargets | null => {
  if (!client || missingTargetFields(client).length) return null;
  const weight = Number(client.weight);
  const height = Number(client.height);
  const age = ageFrom(client.date_of_birth!);
  const gender = client.gender!.toLowerCase();
  const rule = GOAL_RULES[client.goal!] ?? GOAL_RULES.maintain;

  const genderOffset = gender === 'male' ? 5 : gender === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const tdee = bmr * rule.activity.factor;

  const floor = gender === 'male' ? 1500 : 1200;
  const kcalMin = Math.max(floor, roundTo(tdee + rule.kcalOffset.min, 50));
  const kcalMax = Math.max(kcalMin + 100, roundTo(tdee + rule.kcalOffset.max, 50));
  const kcalMid = (kcalMin + kcalMax) / 2;

  // With obesity, protein is based on an adjusted weight rather than total weight.
  const bmi = weight / (height / 100) ** 2;
  const idealWeight = 22 * (height / 100) ** 2;
  const proteinBasisKg = bmi >= 30 ? idealWeight + 0.4 * (weight - idealWeight) : weight;

  const ranges: Record<MacroKey, Range> = {
    calories: { min: kcalMin, max: kcalMax },
    protein_g: {
      min: Math.round(proteinBasisKg * rule.proteinPerKg.min),
      max: Math.round(proteinBasisKg * rule.proteinPerKg.max),
    },
    carbs_g: {
      min: Math.round((kcalMid * rule.carbsPct.min) / 100 / 4),
      max: Math.round((kcalMid * rule.carbsPct.max) / 100 / 4),
    },
    fat_g: {
      min: Math.round((kcalMid * rule.fatPct.min) / 100 / 9),
      max: Math.round((kcalMid * rule.fatPct.max) / 100 / 9),
    },
    // ~14 g per 1,000 kcal, at least 25 g.
    fiber_g: { min: Math.max(25, Math.round((kcalMid / 1000) * 14)), max: Math.max(38, Math.round((kcalMid / 1000) * 14) + 10) },
  };

  const offset = rule.kcalOffset;
  const basis = [
    `BMR ${Math.round(bmr).toLocaleString('en-IN')} kcal (Mifflin-St Jeor: ${age} y, ${gender}, ${height} cm, ${weight} kg)`,
    `Maintenance ~${Math.round(tdee).toLocaleString('en-IN')} kcal, assuming ${rule.activity.label}`,
    offset.min >= 0
      ? `${rule.label}: surplus of ${offset.min}–${offset.max} kcal`
      : offset.max <= 0
        ? `${rule.label}: deficit of ${-offset.max}–${-offset.min} kcal`
        : `${rule.label}: within ±${offset.max} kcal of maintenance`,
    `Protein ${rule.proteinPerKg.min}–${rule.proteinPerKg.max} g/kg${bmi >= 30 ? ` of adjusted weight (${Math.round(proteinBasisKg)} kg, BMI ${bmi.toFixed(1)})` : ''}; carbs ${rule.carbsPct.min}–${rule.carbsPct.max}% and fat ${rule.fatPct.min}–${rule.fatPct.max}% of calories`,
  ];

  return {
    goal: client.goal!,
    goalLabel: rule.label,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    activityLabel: rule.activity.label,
    proteinBasisKg,
    ranges,
    basis,
  };
};

export type TargetStatus = 'low' | 'ok' | 'high';

export const compareToTarget = (value: number, range: Range): TargetStatus =>
  value < range.min ? 'low' : value > range.max ? 'high' : 'ok';

// Why a value is flagged, for the analysis view.
export const targetReason = (targets: NutritionTargets, key: MacroKey, status: TargetStatus) => {
  if (status === 'ok') return null;
  const rule = GOAL_RULES[targets.goal] ?? GOAL_RULES.maintain;
  return rule.why[key][status];
};

// Share of the day's calories and protein per meal, for the generator's budget.
const MEAL_SPLIT: { period: string; kcal: number; protein: number }[] = [
  { period: 'Upon waking up', kcal: 0.03, protein: 0.02 },
  { period: 'Breakfast', kcal: 0.22, protein: 0.22 },
  { period: 'Mid Morning', kcal: 0.1, protein: 0.1 },
  { period: 'Lunch', kcal: 0.25, protein: 0.24 },
  { period: 'Evening Snack', kcal: 0.12, protein: 0.12 },
  { period: 'Dinner', kcal: 0.22, protein: 0.22 },
  { period: 'Bedtime', kcal: 0.06, protein: 0.08 },
];

// Plain-text brief for the AI diet plan generator.
export const targetsToPromptText = (t: NutritionTargets) => {
  const r = t.ranges;
  const kcal = (r.calories.min + r.calories.max) / 2;
  const protein = (r.protein_g.min + r.protein_g.max) / 2;
  const budget = MEAL_SPLIT.map(
    (m) => `  - ${m.period}: ~${roundTo(kcal * m.kcal, 10)} kcal, ~${Math.round(protein * m.protein)} g protein`,
  );
  return [
    `Goal: ${t.goalLabel}`,
    `Daily calories: ${r.calories.min}–${r.calories.max} kcal (maintenance ~${t.tdee} kcal)`,
    `Protein: ${r.protein_g.min}–${r.protein_g.max} g/day`,
    `Carbohydrates: ${r.carbs_g.min}–${r.carbs_g.max} g/day`,
    `Fat: ${r.fat_g.min}–${r.fat_g.max} g/day`,
    `Fibre: at least ${r.fiber_g.min} g/day`,
    `Per-meal budget (adjust if you use different meal times, but keep the daily total):`,
    ...budget,
    `Basis: ${t.basis.join('; ')}`,
  ].join('\n');
};
