import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    text: z.string().max(500).default(""),
    image: z.object({ base64: z.string().max(7_000_000), contentType: z.string().regex(/^image\//) }).nullable().default(null),
  }).parse(d))
  .handler(async ({ data }) => {
    const { processConversation } = await import("@/lib/whatsapp/conversation-engine");
    const { reply } = await processConversation({
      from: data.from,
      text: data.text,
      media: data.image ? { ...data.image } : null,
      channel: "admin_simulator",
    });
    return { reply };
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
