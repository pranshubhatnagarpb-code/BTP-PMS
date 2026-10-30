// Supabase returns at most 1,000 rows per request, and the recipe bank and the
// meal names list are bigger, so full reads go through here a page at a time.
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(table: string, columns: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables outside the generated types too
    const { data, error } = await (supabase as any)
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export const fetchAllMealRecipes = <T>(columns: string) => fetchAllRows<T>('meal_recipes', columns, 'Meal_name');

// A quantity at the start of a recipe name ("1 bowl", "1.5 bowl", "1 mug [300 ml]",
// "10 ml"): portions belong in the diet plan, not in the recipe bank's names.
const LEADING_QUANTITY =
  /^\s*[\d.½¼¾/]+\s*(?:bowls?|katoris?|mugs?|glass(?:es)?|cups?|tsp|tbsp|teaspoons?|tablespoons?|litres?|liters?|ml|plates?)\b\.?\s*(?:\[[^\]]*\]\s*)?(?:of\s+)?/i;

/** "1 glass variyali pani" -> "Variyali pani"; other names are returned as they are. */
export const stripLeadingQuantity = (name: string): string => {
  const rest = name.replace(LEADING_QUANTITY, '').trim();
  if (!rest || rest === name.trim()) return name;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
};
