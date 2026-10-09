export interface HistoricalMeal { date: string; meals: number }

export function prepareHistoricalMeals(rows: HistoricalMeal[], targetDate: string): HistoricalMeal[] {
  const seen = new Set<string>();
  const history: HistoricalMeal[] = [];
  for (const row of rows) {
    if (row.date >= targetDate) continue;
    if (seen.has(row.date)) throw new Error(`Duplicate historical date: ${row.date}. Keep one daily total per date.`);
    seen.add(row.date);
    history.push(row);
  }
  return history.sort((a, b) => a.date.localeCompare(b.date));
}

export function recommendedProductionRange(predicted: number): { low: number; high: number } {
  return { low: Math.max(0, Math.floor(predicted * 0.93)), high: Math.ceil(predicted * 1.07) };
}
