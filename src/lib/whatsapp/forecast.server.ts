/** Server-side demand forecast based only on uploaded meal history or the
 * kitchen's configured daily meal baseline. Surplus quantities are not demand.
 */

import { fetchWeather, isWeatherConfigured } from "./weather.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareHistoricalMeals, recommendedProductionRange } from "./forecast-math";

interface HistoricalMeal {
  date: string;
  meals: number;
}

interface ForecastInput {
  kitchenId: string;
  city: string | null;
  targetDate: Date;
  historicalRows: HistoricalMeal[];
  dailyMeals: number | null;
}

export interface ForecastResult {
  forecast_date: string;
  predicted_demand: number;
  recommended_production_low: number;
  recommended_production_high: number;
  confidence_level: "low" | "medium" | "high";
  historical_baseline: number;
  forecast_source: "historical" | "baseline";
  explanation: string;
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
  const supabase = (await db()) as unknown as SupabaseClient;
  const { kitchenId, city, targetDate, historicalRows, dailyMeals } = input;
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const history = prepareHistoricalMeals(historicalRows, targetDateStr);
  const baseline = history.length
    ? Math.round(history.reduce((sum, row) => sum + row.meals, 0) / history.length)
    : 0;
  const drivers: ForecastResult["drivers"] = [];
  const dayOfWeek = targetDate.getUTCDay();
  let forecastSource: ForecastResult["forecast_source"];
  let predicted: number;
  let confidence: ForecastResult["confidence_level"] = "low";
  let explanation: string;

  if (history.length >= 3) {
    forecastSource = "historical";
    const recent = history.slice(-7);
    const recentAverage = recent.reduce((sum, row) => sum + row.meals, 0) / recent.length;
    const matchingWeekdays = history.filter((row) => new Date(`${row.date}T12:00:00Z`).getUTCDay() === dayOfWeek);
    const weekdayAverage = matchingWeekdays.length
      ? matchingWeekdays.reduce((sum, row) => sum + row.meals, 0) / matchingWeekdays.length
      : null;

    predicted = weekdayAverage === null
      ? recentAverage
      : recentAverage * 0.7 + weekdayAverage * 0.3;
    drivers.push({
      factor: "Recent uploaded demand",
      effect: `Average of the ${recent.length} most recent reported day${recent.length === 1 ? "" : "s"}`,
      impact: Math.round(recentAverage - baseline),
    });
    if (weekdayAverage !== null) {
      drivers.push({
        factor: "Day-of-week pattern",
        effect: `Blended with ${matchingWeekdays.length} matching weekday observation${matchingWeekdays.length === 1 ? "" : "s"}`,
        impact: Math.round(weekdayAverage - recentAverage),
      });
    }
    if (history.length >= 28) confidence = "high";
    else if (history.length >= 14) confidence = "medium";
    explanation = `Weighted baseline from ${history.length} uploaded days: recent demand${weekdayAverage === null ? " only" : " (70%)"}${weekdayAverage === null ? "." : " plus matching weekday history (30%)."}`;
  } else {
    forecastSource = "baseline";
    if (history.length > 0) {
      predicted = baseline;
      explanation = `Demo baseline from ${history.length} uploaded day${history.length === 1 ? "" : "s"}; upload at least 3 distinct days to use recent and weekday patterns.`;
    } else if (dailyMeals != null && dailyMeals > 0) {
      predicted = dailyMeals;
      explanation = "Demo baseline from the kitchen's configured daily meal capacity; upload at least 3 distinct historical days for a data-based forecast.";
    } else {
      throw new Error("Not enough historical meal data and this kitchen has no daily meal baseline. Upload at least 3 days or configure the kitchen's daily meal capacity.");
    }
    drivers.push({ factor: "Baseline/demo forecast", effect: explanation, impact: 0 });
  }

  predicted = Math.round(predicted);

  let weatherAvailable = false;
  let weatherTemp: number | null = null;
  let weatherCondition: string | null = null;
  let weatherNote = "Weather was not used; the forecast continues without external data.";

  if (city && isWeatherConfigured()) {
    try {
      const weather = await fetchWeather(city, targetDate);
      if (weather?.is_forecast) {
        weatherAvailable = true;
        weatherTemp = weather.temperature_c;
        weatherCondition = weather.condition_text;
        if (weather.condition_text.toLowerCase().includes("rain") || weather.precipitation_mm > 2) {
          const effect = Math.round(predicted * -0.12);
          predicted += effect;
          drivers.push({ factor: "Weather signal", effect: "Rain may reduce demand", impact: effect });
        }
        if (weather.temperature_c > 38) {
          const effect = Math.round(predicted * -0.05);
          predicted += effect;
          drivers.push({ factor: "Weather signal", effect: "High heat may reduce demand", impact: effect });
        }
        weatherNote = `Forecast weather: ${weather.condition_text}, ${weather.temperature_c}°C.`;
      } else if (weather) {
        weatherNote = "The configured source returned current conditions, not a forecast for this date; weather was not applied.";
      } else {
        weatherNote = "Weather is unavailable for this date; forecast was calculated without it.";
      }
    } catch (error) {
      console.warn("Weather unavailable; continuing without weather.", error);
      weatherNote = "Weather service or cache is unavailable; forecast was calculated without weather.";
    }
  } else if (!city) {
    weatherNote = "No kitchen city is configured; forecast was calculated without weather.";
  } else {
    weatherNote = "Weather integration is not configured; forecast was calculated without weather.";
  }

  predicted = Math.max(0, predicted);
  const { low: recommendedLow, high: recommendedHigh } = recommendedProductionRange(predicted);
  const result: ForecastResult = {
    forecast_date: targetDateStr,
    predicted_demand: predicted,
    recommended_production_low: recommendedLow,
    recommended_production_high: recommendedHigh,
    confidence_level: confidence,
    historical_baseline: baseline,
    forecast_source: forecastSource,
    explanation,
    drivers,
    weather_available: weatherAvailable,
    weather_temp_c: weatherTemp,
    weather_condition: weatherCondition,
    weather_note: weatherNote,
  };

  const { data: existing, error: lookupError } = await supabase
    .from("demand_forecasts")
    .select("id")
    .eq("kitchen_id", kitchenId)
    .eq("forecast_date", targetDateStr)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw new Error(`Forecast lookup failed: ${lookupError.message}`);

  const forecastRecord = {
    kitchen_id: kitchenId,
    forecast_date: targetDateStr,
    predicted_demand: predicted,
    recommended_production_low: recommendedLow,
    recommended_production_high: recommendedHigh,
    confidence_level: confidence,
    historical_baseline: baseline,
    drivers: [{ factor: "Forecast source", effect: forecastSource, impact: 0 }, ...drivers],
    weather_available: weatherAvailable,
  };
  const { error: saveError } = existing
    ? await supabase.from("demand_forecasts").update(forecastRecord).eq("id", existing.id)
    : await supabase.from("demand_forecasts").insert(forecastRecord);
  if (saveError) throw new Error(`Forecast could not be saved: ${saveError.message}`);

  return result;
}

export function formatForecastResult(forecast: ForecastResult): string {
  return [
    "Demand Forecast",
    `Period: ${forecast.forecast_date}`,
    `Predicted demand: ${forecast.predicted_demand} meals`,
    `Recommended production: ${forecast.recommended_production_low}–${forecast.recommended_production_high} meals`,
    `Method: ${forecast.explanation}`,
    forecast.weather_note,
  ].join("\n");
}
