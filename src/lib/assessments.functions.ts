import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const isoDateSchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Date must be a valid YYYY-MM-DD value.");

export const listWhatsAppAssessments = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("food_assessments")
    .select("id, food_name, ai_estimated_quantity, confirmed_quantity, ai_estimated_weight, quality_screening_status, confirmation_status, analysis_mode, created_at, visual_quality, freshness, confidence_percent, safety_status, kitchens(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    ...r,
    kitchen: (r.kitchens as { name: string } | null)?.name ?? "—",
    kitchens: undefined,
    ai_estimated_weight: r.ai_estimated_weight == null ? null : Number(r.ai_estimated_weight),
  }));
});

/** Demo / Simulation: runs a message through the real conversation engine (same as Twilio). */
export const simulateWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    from: z.string().min(5).max(20),
    text: z.union([
      z.string().max(500),
      z.number(),
      z.record(z.string(), z.unknown()).refine((record) =>
        typeof record["base64"] !== "string" || record["base64"].length <= 7_000_000,
      "Image message is too large."),
    ]).default(""),
    image: z.object({ base64: z.string().max(7_000_000), contentType: z.string().regex(/^image\//) }).nullable().default(null),
  }).parse(d))
  .handler(async ({ data }) => {
    const { processConversation, safeErrorDetails } = await import("@/lib/whatsapp/conversation-engine");
    try {
      const { reply } = await processConversation({
        from: data.from,
        text: data.text,
        media: data.image ? { ...data.image } : null,
        channel: "admin_simulator",
      });
      return { reply };
    } catch (error) {
      const details = safeErrorDetails(error);
      console.error("[WhatsApp simulator] Request failed:", details);
      throw new Error(process.env["NODE_ENV"] === "development"
        ? `Simulator backend error: ${details}`
        : "WhatsApp simulator failed to process the message. Please try again.");
    }
  });

/** Fetch conversation history for a phone number from Supabase. */
export const fetchConversationHistory = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ phone: z.string().min(5).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { getConversationHistory } = await import("@/lib/whatsapp/conversation-engine");
    return await getConversationHistory(data.phone);
  });

/** Fetch conversation session state for a phone number. */
export const fetchSessionState = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ phone: z.string().min(5).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { getSession } = await import("@/lib/whatsapp/conversation-engine");
    const session = await getSession(data.phone);
    return session ? {
      role: session.role,
      state: session.state,
      entity_id: session.entity_id,
    } : null;
  });

/** Reset conversation session for a phone number. */
export const resetConversationSession = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ phone: z.string().min(5).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("conversation_sessions")
      .delete()
      .eq("phone", data.phone);
    return { success: true };
  });

/** List all kitchens for the forecast/procurement UI dropdown. */
export const listKitchens = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { data, error } = await db
    .from("kitchens")
    .select("id, name, city, daily_meals")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((k) => ({ id: k.id, name: k.name, city: k.city, daily_meals: k.daily_meals }));
});

/** Load persisted forecasts for a kitchen so the latest result survives refresh. */
export const listKitchenForecasts = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ kitchenId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: forecasts, error } = await db
      .from("demand_forecasts")
      .select("id, forecast_date, predicted_demand, recommended_production_low, recommended_production_high, confidence_level, historical_baseline, drivers, weather_available, created_at")
      .eq("kitchen_id", data.kitchenId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(`Forecast history could not be loaded: ${error.message}`);
    return forecasts ?? [];
  });

/** Generate a demand forecast for a kitchen on a target date. */
export const generateKitchenForecast = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    kitchenId: z.string().uuid(),
    targetDate: isoDateSchema,
    historicalRows: z.array(z.object({
      date: isoDateSchema,
      meals: z.number().finite().min(0).max(1_000_000),
    })).max(3660),
  }).parse(d))
  .handler(async ({ data }) => {
    const { generateForecast, formatForecastResult } = await import("@/lib/whatsapp/forecast.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const db = supabaseAdmin as unknown as SupabaseClient;
    const { data: kitchen, error } = await db
      .from("kitchens")
      .select("id, city, daily_meals")
      .eq("id", data.kitchenId)
      .maybeSingle();
    if (error) throw new Error(`Kitchen lookup failed: ${error.message}`);
    if (!kitchen) throw new Error("Kitchen not found");

    const target = new Date(`${data.targetDate}T12:00:00.000Z`);
    const result = await generateForecast({
      kitchenId: kitchen.id,
      city: kitchen.city,
      targetDate: target,
      historicalRows: data.historicalRows,
      dailyMeals: kitchen.daily_meals,
    });
    return { ...result, formatted: formatForecastResult(result) };
  });

/** Calculate procurement recommendations for a kitchen. */
export const calculateKitchenProcurement = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    kitchenId: z.string().uuid(),
    predictedServings: z.number().int().min(1),
    dishName: z.string().optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { calculateProcurement, formatProcurementResult } = await import("@/lib/whatsapp/procurement.server");
    const results = await calculateProcurement(data.kitchenId, data.predictedServings, data.dishName);
    return { results, formatted: formatProcurementResult(results) };
  });
