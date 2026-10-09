/**
 * WhatsApp food-photo assessment pipeline (server only).
 * Kitchen photo -> AI vision -> reply -> confirm/correct -> stored assessment + surplus.
 * mode "live": real webhook traffic. mode "demo": the Admin simulator (Demo / Simulation).
 */
export const DISCLAIMER =
  "AI visual screening does not guarantee food safety. Final acceptance remains subject to applicable food-safety procedures and provider confirmation.";

export const QUALITY_STATUSES = ["ELIGIBLE", "REVIEW_REQUIRED", "URGENT", "REJECTED"] as const;
type Quality = (typeof QUALITY_STATUSES)[number];
export type Mode = "live" | "demo";

export interface InboundMessage {
  from: string; // E.164, e.g. +919845011220
  text: string;
  messageSid?: string | undefined;
  media?: { url?: string; contentType: string; base64?: string } | null;
  mode: Mode;
}

interface Analysis {
  food_name: string;
  estimated_portions: number;
  estimated_weight_kg: number;
  quality_screening_status: Quality;
  assessment_note: string;
  analysis_mode: "live_ai" | "demo_simulation";
  model: string | null;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function normalizePhone(raw: string) {
  return raw.replace(/^whatsapp:/i, "").replace(/[^\d+]/g, "");
}

export function classify(text: string, media: InboundMessage["media"]) {
  if (media) {
    if (media.contentType.startsWith("image/")) return "image";
    if (media.contentType.startsWith("audio/")) return "voice";
    return "unknown";
  }
  return text.trim() ? "text" : "unknown";
}

/** Downloads a Twilio media URL through the Lovable connector gateway. */
export async function downloadTwilioMedia(url: string): Promise<{ base64: string; contentType: string }> {
  const lovableKey = process.env['LOVABLE_API_KEY'];
  const twilioKey = process.env['TWILIO_API_KEY'];
  if (!lovableKey || !twilioKey) throw new Error("Twilio connection is not configured");
  const match = url.match(/\/Messages\/(MM\w+)\/Media\/(ME\w+)/);
  if (!match) throw new Error("Unexpected media URL");
  const res = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages/${match[1]}/Media/${match[2]}`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": twilioKey },
  });
  if (!res.ok) throw new Error(`Media download failed [${res.status}]: ${await res.text()}`);
  const size = Number(res.headers.get("content-length") ?? 0);
  if (size > 8 * 1024 * 1024) throw new Error("Image too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error("Image too large");
  return { base64: buf.toString("base64"), contentType: res.headers.get("content-type") ?? "image/jpeg" };
}

const MODEL = "google/gemini-3-flash-preview";

async function analyzeWithAI(base64: string, contentType: string): Promise<Analysis> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You assist an institutional food-rescue service. Look at a photo of surplus cooked/prepared food from a kitchen. Identify the food, estimate how many standard adult portions (~300-450 g each) are visible, and the total food weight in kg. Then perform ONLY a visual quality screening: ELIGIBLE (no visible issues), REVIEW_REQUIRED (unclear image, unusual appearance, can't judge), URGENT (looks fine but appears to be degrading / should move very soon), REJECTED (visible spoilage, mould, contamination, or not food). Never claim food is safe; you only screen visible characteristics. Keep the note to one short sentence.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Assess this surplus food photo." },
            { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_assessment",
            description: "Report the visual food assessment",
            parameters: {
              type: "object",
              properties: {
                food_name: { type: "string" },
                estimated_portions: { type: "integer", minimum: 0 },
                estimated_weight_kg: { type: "number", minimum: 0 },
                quality_screening_status: { type: "string", enum: [...QUALITY_STATUSES] },
                assessment_note: { type: "string" },
              },
              required: ["food_name", "estimated_portions", "estimated_weight_kg", "quality_screening_status", "assessment_note"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_assessment" } },
    }),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured result");
  const p = JSON.parse(args);
  const status = QUALITY_STATUSES.includes(p.quality_screening_status) ? p.quality_screening_status : "REVIEW_REQUIRED";
  return {
    food_name: String(p.food_name).slice(0, 120),
    estimated_portions: Math.max(0, Math.round(Number(p.estimated_portions) || 0)),
    estimated_weight_kg: Math.max(0, Math.round((Number(p.estimated_weight_kg) || 0) * 10) / 10),
    quality_screening_status: status,
    assessment_note: String(p.assessment_note).slice(0, 300),
    analysis_mode: "live_ai",
    model: MODEL,
  };
}

/** Clearly-labelled fallback used only when the AI cannot be reached. */
function demoSimulation(): Analysis {
  return {
    food_name: "Vegetable Rice",
    estimated_portions: 40,
    estimated_weight_kg: 18,
    quality_screening_status: "ELIGIBLE",
    assessment_note: "Demo / Simulation result — the photo was NOT analysed by AI.",
    analysis_mode: "demo_simulation",
    model: null,
  };
}

function assessmentMessage(a: { food_name: string; ai_estimated_quantity: number | null; confirmed_quantity: number | null; ai_estimated_weight: number | null; quality_screening_status: string; assessment_note: string | null; analysis_mode: string }) {
  const lines = [
    "🍱 ResQFood AI Assessment" + (a.analysis_mode === "demo_simulation" ? " (Demo / Simulation)" : ""),
    "",
    `Food: ${a.food_name}`,
    `AI Estimated Portions: ${a.ai_estimated_quantity ?? "—"}`,
  ];
  if (a.confirmed_quantity != null) lines.push(`Updated quantity: ${a.confirmed_quantity} portions`);
  lines.push(`AI Estimated Weight: ${a.ai_estimated_weight ?? "—"} kg`, `Visual Quality Screening: ${a.quality_screening_status}`);
  if (a.assessment_note) lines.push(`Note: ${a.assessment_note}`);
  lines.push("", "Please confirm this assessment.", "", "Reply:", "1 - Confirm", "2 - Correct Quantity", "3 - Reject", "", `ℹ️ ${DISCLAIMER}`);
  return lines.join("\n");
}

async function logMessage(row: { kitchen_id: string | null; ngo_id?: string | null; from_phone: string; provider_message_id?: string | null; message_type: string; message_text: string | null; media_reference?: string | null; direction: "inbound" | "outbound"; mode: Mode }) {
  const supabase = await db();
  const { data, error } = await supabase.from("whatsapp_messages").insert(row).select("id").single();
  if (error) throw new Error(`Failed to log message: ${error.message}`);
  return data.id as string;
}

/** Processes one inbound WhatsApp message and returns the reply text (also logged). */
export async function processInbound(msg: InboundMessage): Promise<{ reply: string; duplicate?: boolean }> {
  const supabase = await db();
  const phone = normalizePhone(msg.from);
  const type = classify(msg.text, msg.media);

  if (msg.messageSid) {
    const { data: dup } = await supabase.from("whatsapp_messages").select("id").eq("provider_message_id", msg.messageSid).maybeSingle();
    if (dup) return { reply: "", duplicate: true };
  }

  const { data: kitchen, error: kErr } = await supabase.from("kitchens").select("*").eq("phone", phone).maybeSingle();
  if (kErr) throw new Error(kErr.message);
  // Role resolution by phone: kitchen first, then NGO/Recipient (never client-supplied).
  const { data: ngo, error: nErr } = kitchen ? { data: null, error: null } : await supabase.from("ngos").select("*").eq("phone", phone).maybeSingle();
  if (nErr) throw new Error(nErr.message);

  const inboundId = await logMessage({
    kitchen_id: kitchen?.id ?? null, ngo_id: ngo?.id ?? null, from_phone: phone, provider_message_id: msg.messageSid ?? null,
    message_type: type, message_text: msg.text || null, media_reference: msg.media?.url ?? (msg.media ? "inline-upload" : null),
    direction: "inbound", mode: msg.mode,
  });

  const handler = ngo
    ? import("./ngo.server").then((m) => m.routeNgo(ngo, type, msg.text))
    : route(kitchen, type, msg, inboundId);
  const reply = await handler.catch((e) => {
    console.error("WhatsApp processing error", e);
    return "Sorry, something went wrong while processing your message. Please try again.";
  });
  await logMessage({ kitchen_id: kitchen?.id ?? null, ngo_id: ngo?.id ?? null, from_phone: phone, message_type: "text", message_text: reply, direction: "outbound", mode: msg.mode });
  return { reply };
}

type KitchenRow = { id: string; name: string; status: string; conversation_state: string; pending_assessment_id: string | null };

async function route(kitchen: KitchenRow | null, type: string, msg: InboundMessage, inboundId: string): Promise<string> {
  const supabase = await db();
  if (!kitchen) return "👋 This number is not registered with ResQFood AI as a kitchen or NGO/Recipient. Please contact the ResQFood team to register.";
  if (kitchen.status !== "approved") return "Your kitchen registration is still pending approval. We'll message you once it's approved.";

  if (type === "voice") return "🎙️ Voice notes are not supported yet. Please send a photo of the surplus food.";
  if (type === "unknown") return "Sorry, this message type is not supported. Please send a photo of the surplus food.";

  if (type === "image") {
    let analysis: Analysis;
    let imageRef = msg.media?.url ?? "inline-upload";
    try {
      const media = msg.media!.base64
        ? { base64: msg.media!.base64, contentType: msg.media!.contentType }
        : await downloadTwilioMedia(msg.media!.url!);
      analysis = await analyzeWithAI(media.base64, media.contentType);
    } catch (e) {
      console.error("AI/media failure, using Demo / Simulation", e);
      analysis = demoSimulation();
      imageRef = imageRef + " (not analysed)";
    }
    const { data: a, error } = await supabase.from("food_assessments").insert({
      kitchen_id: kitchen.id, message_id: inboundId, image_reference: imageRef,
      food_name: analysis.food_name, ai_estimated_quantity: analysis.estimated_portions,
      ai_estimated_weight: analysis.estimated_weight_kg, quality_screening_status: analysis.quality_screening_status,
      assessment_note: analysis.assessment_note, analysis_mode: analysis.analysis_mode, model: analysis.model,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await supabase.from("kitchens").update({ conversation_state: "awaiting_confirmation", pending_assessment_id: a.id }).eq("id", kitchen.id);
    return assessmentMessage(a);
  }

  // text
  const text = msg.text.trim();
  const pending = kitchen.pending_assessment_id
    ? (await supabase.from("food_assessments").select("*").eq("id", kitchen.pending_assessment_id).maybeSingle()).data
    : null;
  if (!pending || kitchen.conversation_state === "idle") {
    return "👋 Hi from ResQFood AI! Send a photo of your surplus food and we'll estimate the portions, weight and do a visual quality screening.";
  }

  if (kitchen.conversation_state === "awaiting_quantity") {
    const n = Number(text.replace(/[^\d]/g, ""));
    if (!/\d/.test(text) || !Number.isFinite(n) || n <= 0 || n > 100000) return "Please enter the actual quantity as a number, e.g. 35.";
    await supabase.from("food_assessments").update({ confirmed_quantity: n, confirmation_status: "awaiting_confirmation" }).eq("id", pending.id);
    await supabase.from("kitchens").update({ conversation_state: "awaiting_confirmation" }).eq("id", kitchen.id);
    return `Updated quantity: ${n} portions.\nPlease confirm.\n\nReply:\n1 - Confirm\n2 - Correct Quantity\n3 - Reject`;
  }

  // awaiting_confirmation
  if (text === "1" || /^confirm/i.test(text)) {
    const qty = pending.confirmed_quantity ?? pending.ai_estimated_quantity ?? 0;
    const { error } = await supabase.from("food_assessments").update({
      confirmed_quantity: qty, confirmation_status: pending.confirmed_quantity != null ? "corrected_confirmed" : "confirmed", confirmed_at: new Date().toISOString(),
    }).eq("id", pending.id);
    if (error) throw new Error(error.message);
    await supabase.from("surplus_food").upsert({
      kitchen_id: kitchen.id, assessment_id: pending.id, food_name: pending.food_name, quantity: qty,
      unit: "portions", estimated_weight_kg: pending.ai_estimated_weight,
      state: pending.quality_screening_status === "REJECTED" ? "REJECTED" : "ASSESSMENT_COMPLETE",
      usable_until: new Date(Date.now() + 4 * 3_600_000).toISOString(), // default 4h window until kitchens report it
    }, { onConflict: "assessment_id" });
    await supabase.from("kitchens").update({ conversation_state: "idle", pending_assessment_id: null }).eq("id", kitchen.id);
    return `✅ Assessment confirmed: ${qty} portions of ${pending.food_name}. It has been recorded with ResQFood AI.`;
  }
  if (text === "2" || /^correct/i.test(text)) {
    await supabase.from("kitchens").update({ conversation_state: "awaiting_quantity" }).eq("id", kitchen.id);
    return "Enter the actual quantity.";
  }
  if (text === "3" || /^reject/i.test(text)) {
    await supabase.from("food_assessments").update({ confirmation_status: "rejected_by_kitchen" }).eq("id", pending.id);
    await supabase.from("kitchens").update({ conversation_state: "idle", pending_assessment_id: null }).eq("id", kitchen.id);
    return "❌ Assessment rejected. Send a new photo whenever you're ready.";
  }
  return "Please reply 1 to Confirm, 2 to Correct Quantity, or 3 to Reject.";
}
