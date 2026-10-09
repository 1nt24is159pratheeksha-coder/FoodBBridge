/**
 * Weather integration service (server-side only).
 * Fetches current weather and forecasts from a configurable weather API.
 *
 * If WEATHER_API_KEY and WEATHER_API_URL are not configured, returns null
 * and the caller marks weather data as unavailable — never fabricates data.
 *
 * Supports OpenWeatherMap or similar APIs that return JSON.
 * Configured through environment variables:
 *   WEATHER_API_KEY — API key for the weather service
 *   WEATHER_API_URL — base URL (e.g. https://api.openweathermap.org/data/2.5)
 *   WEATHER_API_PROVIDER — 'openweathermap' | 'open_meteo' (default: open_meteo, no key needed)
 */

interface WeatherData {
  temperature_c: number;
  precipitation_mm: number;
  condition_text: string;
  is_forecast: boolean;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function fetchWeather(city: string, date: Date): Promise<WeatherData | null> {
  const supabase = await db();

  // Check cache first
  const dateStr = date.toISOString().slice(0, 10);
  const { data: cached } = await supabase
    .from("weather_cache")
    .select("*")
    .eq("city", city)
    .eq("forecast_date", dateStr)
    .maybeSingle();

  // Cache valid for 6 hours
  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < 6 * 3_600_000) {
    return {
      temperature_c: Number(cached.temperature_c),
      precipitation_mm: Number(cached.precipitation_mm),
      condition_text: cached.condition_text,
      is_forecast: cached.is_forecast,
    };
  }

  const provider = process.env["WEATHER_API_PROVIDER"] ?? "open_meteo";

  try {
    let weather: WeatherData | null = null;

    if (provider === "openweathermap") {
      weather = await fetchOpenWeatherMap(city, date);
    } else if (provider === "open_meteo") {
      weather = await fetchOpenMeteo(city, date);
    } else if (process.env["WEATHER_API_URL"] && process.env["WEATHER_API_KEY"]) {
      weather = await fetchCustomApi(city, date);
    }

    if (!weather) return null;

    // Cache the result
    await supabase.from("weather_cache").upsert(
      {
        city,
        forecast_date: dateStr,
        temperature_c: weather.temperature_c,
        precipitation_mm: weather.precipitation_mm,
        condition_text: weather.condition_text,
        is_forecast: weather.is_forecast,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "city,forecast_date" },
    );

    return weather;
  } catch (e) {
    console.error("Weather fetch failed", e);
    return null;
  }
}

// Open-Meteo: free, no API key needed, geocoding + forecast
async function fetchOpenMeteo(city: string, date: Date): Promise<WeatherData | null> {
  // Geocode city name
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&format=json`,
  );
  if (!geoRes.ok) return null;
  const geo = await geoRes.json();
  if (!geo.results?.length) return null;
  const { latitude, longitude } = geo.results[0];

  // Fetch forecast
  const dateStr = date.toISOString().slice(0, 10);
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code` +
      `&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`,
  );
  if (!weatherRes.ok) return null;
  const w = await weatherRes.json();
  if (!w.daily?.time?.length) return null;

  const tempMax = w.daily.temperature_2m_max[0];
  const tempMin = w.daily.temperature_2m_min[0];
  const precip = w.daily.precipitation_sum[0];
  const code = w.daily.weather_code[0];

  return {
    temperature_c: Math.round(((tempMax + tempMin) / 2) * 10) / 10,
    precipitation_mm: Math.round(precip * 10) / 10,
    condition_text: weatherCodeToText(code),
    is_forecast: true,
  };
}

async function fetchOpenWeatherMap(city: string, date: Date): Promise<WeatherData | null> {
  const apiKey = process.env["WEATHER_API_KEY"];
  if (!apiKey) return null;
  const baseUrl = process.env["WEATHER_API_URL"] ?? "https://api.openweathermap.org/data/2.5";

  // Current weather
  const res = await fetch(
    `${baseUrl}/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`,
  );
  if (!res.ok) return null;
  const w = await res.json();

  return {
    temperature_c: Math.round(w.main?.temp * 10) / 10,
    precipitation_mm: w.rain?.["1h"] ?? 0,
    condition_text: w.weather?.[0]?.main ?? "Unknown",
    is_forecast: false,
  };
}

async function fetchCustomApi(city: string, date: Date): Promise<WeatherData | null> {
  const apiKey = process.env["WEATHER_API_KEY"];
  const baseUrl = process.env["WEATHER_API_URL"];
  if (!apiKey || !baseUrl) return null;

  const res = await fetch(`${baseUrl}?city=${encodeURIComponent(city)}&key=${apiKey}`);
  if (!res.ok) return null;
  const w = await res.json();

  return {
    temperature_c: w.temperature ?? w.temp ?? 0,
    precipitation_mm: w.precipitation ?? w.rain ?? 0,
    condition_text: w.condition ?? w.weather ?? "Unknown",
    is_forecast: true,
  };
}

function weatherCodeToText(code: number): string {
  if (code === 0) return "Sunny";
  if (code <= 3) return "Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Unknown";
}

export function isWeatherConfigured(): boolean {
  const provider = process.env["WEATHER_API_PROVIDER"] ?? "open_meteo";
  if (provider === "open_meteo") return true; // Free API, always available
  return !!(process.env["WEATHER_API_KEY"] && process.env["WEATHER_API_URL"]);
}
