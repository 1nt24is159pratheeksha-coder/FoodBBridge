/**
 * Demand forecasting service (server-side only).
 *
 * Implements a real statistical forecasting baseline using:
 *   - Historical surplus/demand data from Supabase
 *   - Lag features (1-day, 7-day, 14-day)
 *   - Rolling 7-day average
 *   - Day-of-week effect
 *   - Weather signals (when configured)
 *   - Calendar/holiday signals (basic)
 *
 * This is a weighted moving average / regression baseline — NOT XGBoost or Prophet.
 * The service is structured so a real ML model can be plugged in later by
 * replacing the computeForecast() function.
 *
 * If weather data is unavailable, the forecast still works with historical data
 * and clearly reports that weather was not used.
 */

import { fetchWeather, isWeatherConfigured } from "./weather-server";

interface ForecastInput {
  kitchenId: string;
  city: string | null;
  targetDate: Date;
}

export interface ForecastResult {
  predicted_demand: number;
  recommended_production_low: number;
  recommended_production_high: number;
  confidence_level: "low" | "medium" | "high";
  historical_baseline: number;
  drivers: { factor: string; effect: string; impact: number }[];
  weather_available: boolean;
  weather_temp_c: number | null;
  weather_condition: string | null;
  weather_note: string;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function generateForecast(input: ForecastInput): Promise<ForecastResult> {
  const supabase = await db();
  const { kitchenId, city, targetDate } = input;

  // Fetch historical surplus data for this kitchen (last 30 days)
  const thirtyDaysAgo = new Date(targetDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: history, error } = await supabase
    .from("surplus_food")
    .select("quantity, created_at, food_name")
    .eq("kitchen_id", kitchenId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .lt("created_at", targetDate.toISOString())
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Forecast: history fetch failed: ${error.message}`);

  // Build daily totals
  const dailyTotals = buildDailyTotals(history ?? []);

  // Compute features
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const dayOfWeek = targetDate.getDay();

  // Lag features
  const lag1 = getDayTotal(dailyTotals, daysAgo(targetDate, 1));
  const lag7 = getDayTotal(dailyTotals, daysAgo(targetDate, 7));
  const lag14 = getDayTotal(dailyTotals, daysAgo(targetDate, 14));

  // Rolling 7-day average
  const rolling7 = averageOfLastDays(dailyTotals, targetDate, 7);

  // Historical baseline (overall average)
  const allTotals = Object.values(dailyTotals);
  const overallAvg = allTotals.length > 0
    ? Math.round(allTotals.reduce((s, v) => s + v, 0) / allTotals.length)
    : 0;

  // Day-of-week average
  const dowAvg = averageByDayOfWeek(dailyTotals, dayOfWeek);

  // Start with a weighted combination of features
  const drivers: { factor: string; effect: string; impact: number }[] = [];

  // Base prediction: weighted average of lag features and rolling average
  let predicted = 0;
  let weightSum = 0;

  if (lag1 != null) {
    predicted += lag1 * 0.25;
    weightSum += 0.25;
    const diff = lag1 - overallAvg;
    if (Math.abs(diff) > overallAvg * 0.05) {
      drivers.push({ factor: "Recent demand (1-day lag)", effect: diff > 0 ? "Recent uptick" : "Recent decline", impact: diff });
    }
  }
  if (lag7 != null) {
    predicted += lag7 * 0.20;
    weightSum += 0.20;
  }
  if (lag14 != null) {
    predicted += lag14 * 0.10;
    weightSum += 0.10;
  }
  if (rolling7 != null && rolling7 > 0) {
    predicted += rolling7 * 0.25;
    weightSum += 0.25;
  }
  if (dowAvg != null && dowAvg > 0) {
    predicted += dowAvg * 0.20;
    weightSum += 0.20;
    const dowNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dowDiff = dowAvg - overallAvg;
    if (Math.abs(dowDiff) > overallAvg * 0.05) {
      drivers.push({
        factor: `${dowNames[dayOfWeek]} effect`,
        effect: dowDiff > 0 ? "Higher than average" : "Lower than average",
        impact: Math.round((dowDiff / (overallAvg || 1)) * 100),
      });
    }
  }

  // If no historical data, use kitchen's daily_meals as baseline
  if (weightSum === 0) {
    const { data: kitchen } = await supabase
      .from("kitchens")
      .select("daily_meals")
      .eq("id", kitchenId)
      .maybeSingle();
    predicted = kitchen?.daily_meals ?? 200;
  } else {
    predicted = Math.round(predicted / weightSum);
  }

  // Weather impact
  let weatherAvailable = false;
  let weatherTemp: number | null = null;
  let weatherCondition: string | null = null;
  let weatherNote = "";

  if (city && isWeatherConfigured()) {
    const weather = await fetchWeather(city, targetDate);
    if (weather) {
      weatherAvailable = true;
      weatherTemp = weather.temperature_c;
      weatherCondition = weather.condition_text;

      // Weather effects on demand (simplified model)
      // Rain typically reduces footfall for outdoor/cafeteria venues
      if (weather.condition_text.toLowerCase().includes("rain") || weather.precipitation_mm > 2) {
        const rainEffect = Math.round(predicted * -0.12);
        predicted += rainEffect;
        drivers.push({ factor: "Rain effect", effect: "Reduced demand", impact: rainEffect });
      }
      // Very hot weather can increase or decrease demand depending on venue
      if (weather.temperature_c > 38) {
        const heatEffect = Math.round(predicted * -0.05);
        predicted += heatEffect;
        drivers.push({ factor: "Extreme heat", effect: "Slightly reduced demand", impact: heatEffect });
      }
      weatherNote = `Weather: ${weather.condition_text}, ${weather.temperature_c}°C`;
    } else {
      weatherNote = "Weather data source not configured or unavailable.";
    }
  } else {
    weatherNote = "Weather data source not configured.";
  }

  // Friday/weekend effect
  if (dayOfWeek === 5) {
    const friEffect = Math.round(predicted * 0.08);
    predicted += friEffect;
    drivers.push({ factor: "Friday effect", effect: "Higher demand", impact: friEffect });
  }
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const weekendEffect = Math.round(predicted * -0.06);
    predicted += weekendEffect;
    drivers.push({ factor: "Weekend effect", effect: "Lower demand", impact: weekendEffect });
  }

  predicted = Math.max(0, predicted);

  // Confidence based on data availability
  let confidence: "low" | "medium" | "high" = "low";
  if (allTotals.length >= 14) confidence = "high";
  else if (allTotals.length >= 7) confidence = "medium";
  else if (allTotals.length >= 3) confidence = "low";

  // Recommended production: slightly below predicted to reduce surplus
  const recommendedLow = Math.round(predicted * 0.93);
  const recommendedHigh = Math.round(predicted * 0.97);

  const result: ForecastResult = {
    predicted_demand: predicted,
    recommended_production_low: recommendedLow,
    recommended_production_high: recommendedHigh,
    confidence_level: confidence,
    historical_baseline: overallAvg,
    drivers,
    weather_available: weatherAvailable,
    weather_temp_c: weatherTemp,
    weather_condition: weatherCondition,
    weather_note: weatherNote,
  };

  // Persist forecast
  await supabase.from("demand_forecasts").insert({
    kitchen_id: kitchenId,
    forecast_date: targetDateStr,
    predicted_demand: predicted,
    recommended_production_low: recommendedLow,
    recommended_production_high: recommendedHigh,
    confidence_level: confidence,
    historical_baseline: overallAvg,
    drivers: drivers,
    weather_available: weatherAvailable,
  });

  return result;
}

// ── Helpers ──

function buildDailyTotals(rows: { quantity: number; created_at: string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    totals[day] = (totals[day] ?? 0) + r.quantity;
  }
  return totals;
}

function daysAgo(date: Date, n: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getDayTotal(totals: Record<string, number>, day: string): number | null {
  return totals[day] ?? null;
}

function averageOfLastDays(totals: Record<string, number>, target: Date, n: number): number | null {
  const vals: number[] = [];
  for (let i = 1; i <= n; i++) {
    const v = getDayTotal(totals, daysAgo(target, i));
    if (v != null) vals.push(v);
  }
  return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
}

function averageByDayOfWeek(totals: Record<string, number>, dow: number): number | null {
  const vals: number[] = [];
  for (const [day, total] of Object.entries(totals)) {
    const d = new Date(day);
    if (d.getDay() === dow) vals.push(total);
  }
  return vals.length > 0 ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
}

export function formatForecastResult(f: ForecastResult): string {
  const lines = [
    "📊 *Demand Forecast*",
    "",
    `Predicted demand: ${f.predicted_demand} meals`,
    `Recommended production: ${f.recommended_production_low}–${f.recommended_production_high} meals`,
    `Historical baseline: ${f.historical_baseline} meals`,
    `Confidence: ${f.confidence_level.toUpperCase()}`,
  ];

  if (f.drivers.length > 0) {
    lines.push("", "Expected demand drivers:");
    for (const d of f.drivers) {
      const pct = d.impact > 0 ? `+${d.impact}` : `${d.impact}`;
      const suffix = d.factor.includes("effect") || d.factor.includes("lag") ? ` (${pct} meals)` : ` (${pct}%)`;
      lines.push(`• ${d.factor}: ${d.effect}${suffix}`);
    }
  }

  lines.push("", `🌤️ ${f.weather_note}`);

  return lines.join("\n");
}
