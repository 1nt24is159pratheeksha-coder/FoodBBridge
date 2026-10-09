import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Calculator, Cloud, Download, Loader2, ShoppingBag, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  calculateKitchenProcurement,
  generateKitchenForecast,
  listKitchenForecasts,
  listKitchens,
} from "@/lib/assessments.functions";

interface MealDay {
  date: string;
  meals: number;
}

interface ForecastData {
  forecast_date: string;
  predicted_demand: number;
  recommended_production_low: number;
  recommended_production_high: number;
  confidence_level: string;
  historical_baseline: number;
  forecast_source: "historical" | "baseline";
  explanation: string;
  drivers: { factor: string; effect: string; impact: number }[];
  weather_available: boolean;
  weather_temp_c: number | null;
  weather_condition: string | null;
  weather_note: string;
}

interface ProcurementIngredient {
  name: string;
  required: number;
  unit: string;
  in_stock: number;
  recommended_purchase: number;
  inventory_recorded: boolean;
}

interface ProcurementResult {
  dish_name: string;
  predicted_servings: number;
  ingredients: ProcurementIngredient[];
  note: string;
}

interface SavedForecast {
  id: string;
  forecast_date: string;
  predicted_demand: number;
  recommended_production_low: number;
  recommended_production_high: number;
  confidence_level: string;
  historical_baseline: number;
  drivers: { factor: string; effect: string; impact: number }[];
  weather_available: boolean;
}

const confidenceColors: Record<string, string> = {
  high: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  low: "bg-muted text-muted-foreground",
};

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseMealCsv(text: string): { rows: MealDay[]; skipped: number } {
  const records = parseCsv(text);
  if (records.length < 2) throw new Error("Add a header and at least one data row to the CSV.");
  const headerRow = records[0];
  if (!headerRow) throw new Error("The CSV header row is missing.");
  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, "").trim().toLowerCase());
  const dateIndex = headers.indexOf("date");
  const mealsIndex = ["meals", "meal_count", "sales", "quantity"].map((name) => headers.indexOf(name)).find((index) => index >= 0);
  if (dateIndex < 0 || mealsIndex == null) {
    throw new Error('Required columns: "date" and "meals" (or "meal_count", "sales" as meal counts, or "quantity"). Sales must be a count of meals, not currency.');
  }
  if (records.length - 1 > 3660) throw new Error("A CSV can contain at most 3,660 data rows.");

  const rows: MealDay[] = [];
  const errors: string[] = [];
  let skipped = 0;
  for (const [index, record] of records.slice(1).entries()) {
    const date = record[dateIndex]?.trim() ?? "";
    const mealsText = record[mealsIndex]?.trim() ?? "";
    if (!date || !mealsText) {
      skipped++;
      continue;
    }
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      errors.push(`Row ${index + 2}: date must be a valid YYYY-MM-DD value.`);
      continue;
    }
    const meals = Number(mealsText);
    if (!Number.isFinite(meals) || meals < 0 || meals > 1_000_000) {
      errors.push(`Row ${index + 2}: meal count must be a number from 0 to 1,000,000.`);
      continue;
    }
    rows.push({ date, meals });
  }
  if (errors.length) {
    const shown = errors.slice(0, 5).join(" ");
    throw new Error(`${errors.length} invalid row${errors.length === 1 ? "" : "s"}. ${shown}${errors.length > 5 ? ` Plus ${errors.length - 5} more.` : ""}`);
  }
  if (!rows.length) throw new Error("No complete meal records were found. Rows missing a date or meal count are skipped.");
  return { rows, skipped };
}

function downloadSampleCsv() {
  const today = new Date();
  const rows = ["date,meals"];
  for (let offset = 14; offset >= 1; offset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    rows.push(`${localDateString(day)},${180 + ((offset * 17) % 65)}`);
  }
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "resqfood-sample-meal-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function ForecastProcurementPanel() {
  const queryClient = useQueryClient();
  const listKitchensFn = useServerFn(listKitchens);
  const listForecastsFn = useServerFn(listKitchenForecasts);
  const forecastFn = useServerFn(generateKitchenForecast);
  const procurementFn = useServerFn(calculateKitchenProcurement);
  const { data: kitchens, isLoading: kitchensLoading, isError: kitchensFailed, error: kitchensError } = useQuery({
    queryKey: ["forecast-kitchens"],
    queryFn: () => listKitchensFn(),
  });

  const [selectedKitchen, setSelectedKitchen] = useState("");
  const [targetDate, setTargetDate] = useState(localDateString);
  const [mealRows, setMealRows] = useState<MealDay[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [procurement, setProcurement] = useState<{ results: ProcurementResult[]; formatted: string } | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingProcurement, setLoadingProcurement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forecastBusy = useRef(false);
  const procurementBusy = useRef(false);

  useEffect(() => {
    if (!selectedKitchen && kitchens?.[0]) setSelectedKitchen(kitchens[0].id);
  }, [kitchens, selectedKitchen]);

  const savedQuery = useQuery({
    queryKey: ["saved-kitchen-forecasts", selectedKitchen],
    queryFn: () => listForecastsFn({ data: { kitchenId: selectedKitchen } }),
    enabled: Boolean(selectedKitchen),
  });

  const onCsvSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setUploadError(null);
    setUploadStatus(null);
    setMealRows([]);
    setForecast(null);
    setProcurement(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setUploadError("Choose a CSV file. XLSX upload is not configured for this project.");
      return;
    }
    try {
      const parsed = parseMealCsv(await file.text());
      setMealRows(parsed.rows);
      const distinctDays = new Set(parsed.rows.map((row) => row.date)).size;
      setUploadStatus(`${parsed.rows.length} records across ${distinctDays} distinct days loaded${parsed.skipped ? `; ${parsed.skipped} incomplete row${parsed.skipped === 1 ? "" : "s"} skipped` : ""}.`);
    } catch (e) {
      setUploadError((e as Error).message);
    }
  };

  const runForecast = async () => {
    if (!selectedKitchen || forecastBusy.current) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setError("Choose a valid forecast date.");
      return;
    }
    forecastBusy.current = true;
    setLoadingForecast(true);
    setError(null);
    setForecast(null);
    setProcurement(null);
    try {
      const r = await forecastFn({ data: { kitchenId: selectedKitchen, targetDate, historicalRows: mealRows } });
      setForecast(r as ForecastData);
      await queryClient.invalidateQueries({ queryKey: ["saved-kitchen-forecasts", selectedKitchen] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      forecastBusy.current = false;
      setLoadingForecast(false);
    }
  };

  const runProcurement = async () => {
    if (!selectedKitchen || !forecast || procurementBusy.current) return;
    procurementBusy.current = true;
    setLoadingProcurement(true);
    setError(null);
    setProcurement(null);
    try {
      const r = await procurementFn({
        data: { kitchenId: selectedKitchen, predictedServings: forecast.predicted_demand },
      });
      setProcurement(r as { results: ProcurementResult[]; formatted: string });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      procurementBusy.current = false;
      setLoadingProcurement(false);
    }
  };

  const savedForecasts = (savedQuery.data ?? []) as unknown as SavedForecast[];

  return (
    <div className="space-y-6">
      <div className="surface space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold">Historical Meal Data</h3>
          <p className="mt-1 text-xs text-muted-foreground">Upload daily meal counts as CSV. Accepted columns: date and meals (or meal_count, sales as meal counts, or quantity). No surplus records are used as demand.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted/40">
            <Upload className="size-4" /> Choose CSV
            <input className="sr-only" type="file" accept=".csv,text/csv" onChange={onCsvSelected} />
          </label>
          <Button type="button" variant="outline" onClick={downloadSampleCsv}>
            <Download className="size-4" /> Download sample CSV
          </Button>
          <span className="text-xs text-muted-foreground">CSV is used for this forecast and is not uploaded to a database.</span>
        </div>
        {uploadStatus && <p className="text-xs text-success">{uploadStatus}</p>}
        {uploadError && <p className="flex items-center gap-2 text-xs text-danger"><AlertCircle className="size-4" />{uploadError}</p>}
      </div>

      <div className="surface flex flex-wrap items-end gap-4">
        <div className="min-w-48 flex-1">
          <label htmlFor="forecast-kitchen" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Select Kitchen</label>
          <select
            id="forecast-kitchen"
            value={selectedKitchen}
            onChange={(event) => {
              setSelectedKitchen(event.target.value);
              setMealRows([]);
              setUploadStatus(null);
              setUploadError(null);
              setForecast(null);
              setProcurement(null);
              setError(null);
            }}
            disabled={kitchensLoading || !kitchens?.length}
            className="w-full rounded-md border border-border bg-panel px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {kitchensLoading && <option value="">Loading kitchens…</option>}
            {!kitchensLoading && !kitchens?.length && <option value="">No kitchens available</option>}
            {kitchens?.map((k) => <option key={k.id} value={k.id}>{k.name}{k.city ? ` · ${k.city}` : ""}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="forecast-date" className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Forecast date</label>
          <input id="forecast-date" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="rounded-md border border-border bg-panel px-3 py-2 text-sm" />
        </div>
        <Button onClick={runForecast} disabled={!selectedKitchen || loadingForecast || loadingProcurement}>
          {loadingForecast ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
          Generate Forecast
        </Button>
        {forecast && <Button onClick={runProcurement} disabled={loadingProcurement || loadingForecast} variant="outline">
          {loadingProcurement ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
          Calculate Procurement
        </Button>}
      </div>

      {kitchensFailed && <div className="surface flex items-center gap-2 text-sm text-danger"><AlertCircle className="size-4" />Kitchen list failed to load: {(kitchensError as Error).message}</div>}
      {savedQuery.isError && <div className="surface text-sm text-danger">Saved forecasts failed to load: {(savedQuery.error as Error).message}</div>}
      {error && <div className="surface flex items-center gap-2 border-danger/20 text-danger"><AlertCircle className="size-4 shrink-0" /><span className="text-sm">{error}</span></div>}

      {loadingForecast && <div className="surface flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin" /><span className="text-sm">Calculating and saving forecast…</span></div>}

      {forecast && (
        <div className="surface space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <h3 className="font-display text-lg font-bold">Demand Forecast · {forecast.forecast_date}</h3>
            <Badge className={`ml-auto text-[10px] ${confidenceColors[forecast.confidence_level] ?? ""}`}>{forecast.confidence_level.toUpperCase()} confidence</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{forecast.forecast_source === "historical" ? "Uploaded historical data" : "Baseline / demo"}</Badge>
            <Badge variant="outline">{forecast.weather_available ? "Weather included" : "No weather applied"}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Predicted demand" value={forecast.predicted_demand} suffix="meals" />
            <Metric label="Recommended production" value={`${forecast.recommended_production_low}–${forecast.recommended_production_high}`} suffix="meals" />
            <Metric label="Uploaded history baseline" value={forecast.historical_baseline} suffix="meals/day" />
            <div className="rounded-lg border border-border bg-panel/50 p-3">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">Forecast weather</p>
              <p className="mt-1 flex items-center gap-1 font-display text-lg font-bold"><Cloud className="size-4" />{forecast.weather_available ? `${forecast.weather_temp_c}°C` : "Unavailable"}</p>
              <p className="text-[10px] text-muted-foreground">{forecast.weather_condition ?? "No forecast data applied"}</p>
            </div>
          </div>
          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{forecast.explanation}</p>
          {forecast.drivers.length > 0 && <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Recommendation factors</p>
            {forecast.drivers.map((driver, index) => <div key={`${driver.factor}-${index}`} className="rounded-md border border-border/60 px-3 py-2 text-xs"><span className="font-medium">{driver.factor}</span><span className="text-muted-foreground"> — {driver.effect}</span></div>)}
          </div>}
          <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">{forecast.weather_note}</p>
        </div>
      )}

      {loadingProcurement && <div className="surface flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-5 animate-spin" /><span className="text-sm">Calculating from recipes and current inventory…</span></div>}
      {procurement && <div className="surface space-y-4">
        <div className="flex items-center gap-2"><ShoppingBag className="size-5 text-primary" /><h3 className="font-display text-lg font-bold">Procurement Recommendation</h3></div>
        {procurement.results.map((result, index) => <div key={`${result.dish_name}-${index}`} className="space-y-2">
          <div className="flex items-center gap-2"><Calculator className="size-4 text-muted-foreground" /><p className="text-sm font-semibold">{result.dish_name} — {result.predicted_servings} servings</p></div>
          {!result.ingredients.length ? <div className="flex items-center gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2 text-xs text-warning"><AlertCircle className="size-4 shrink-0" />{result.note}</div> : <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-left text-xs"><thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground"><tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2">Required</th><th className="px-3 py-2">In stock</th><th className="px-3 py-2">Additional to procure</th><th className="px-3 py-2">Unit</th></tr></thead>
              <tbody className="divide-y divide-border/50">{result.ingredients.map((ingredient, rowIndex) => <tr key={`${ingredient.name}-${rowIndex}`}>
                <td className="px-3 py-2 font-medium">{ingredient.name}</td><td className="px-3 py-2">{ingredient.required}</td>
                <td className="px-3 py-2">{ingredient.inventory_recorded ? ingredient.in_stock : <span className="text-warning">Not recorded (assumed 0)</span>}</td>
                <td className={`px-3 py-2 font-bold ${ingredient.recommended_purchase > 0 ? "text-primary" : "text-muted-foreground"}`}>{ingredient.recommended_purchase}</td><td className="px-3 py-2 text-muted-foreground">{ingredient.unit}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          <p className="text-[10px] text-muted-foreground">{result.note}</p>
        </div>)}
      </div>}

      <div className="surface space-y-3">
        <div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold">Saved Forecasts</h3><p className="text-xs text-muted-foreground">Latest forecasts saved for this kitchen.</p></div>{savedQuery.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}</div>
        {!selectedKitchen ? <p className="text-xs text-muted-foreground">Select a kitchen to view saved forecasts.</p> : !savedQuery.isLoading && !savedForecasts.length ? <p className="text-xs text-muted-foreground">No saved forecasts yet. Generate one to see it here after refresh.</p> : savedForecasts.length > 0 && <div className="overflow-x-auto rounded-md border border-border"><table className="w-full text-left text-xs"><thead className="border-b border-border bg-muted/40 text-[10px] uppercase text-muted-foreground"><tr><th className="px-3 py-2">Forecast date</th><th className="px-3 py-2">Predicted meals</th><th className="px-3 py-2">Production range</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Confidence</th></tr></thead><tbody className="divide-y divide-border/50">{savedForecasts.map((item) => <tr key={item.id}><td className="px-3 py-2">{item.forecast_date}</td><td className="px-3 py-2">{item.predicted_demand}</td><td className="px-3 py-2">{item.recommended_production_low}–{item.recommended_production_high}</td><td className="px-3 py-2">{item.drivers?.find((driver) => driver.factor === "Forecast source")?.effect === "historical" ? "Uploaded history" : "Baseline / demo"}</td><td className="px-3 py-2">{item.confidence_level}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string | number; suffix: string }) {
  return <div className="rounded-lg border border-border bg-panel/50 p-3"><p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">{value}</p><p className="text-[10px] text-muted-foreground">{suffix}</p></div>;
}
