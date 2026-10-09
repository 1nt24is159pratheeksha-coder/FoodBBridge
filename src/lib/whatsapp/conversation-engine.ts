/**
 * Shared WhatsApp conversation engine — the single brain used by both
 * the Admin Web Simulator and the Twilio webhook.
 *
 * Transport layer calls processConversation() with:
 *   - phone, text, media (image), channel ('admin_simulator' | 'whatsapp')
 *
 * The engine resolves or creates a conversation_session, determines the
 * sender's role (kitchen / ngo / unregistered), and routes the message
 * through registration → menu → workflow state machine.
 *
 * All state persists in Supabase (conversation_sessions table) so it
 * survives between messages regardless of transport.
 */

import { normalizePhone, classify, type InboundMessage, type Mode } from "./pipeline.server";
import { analyzeFoodImage, type AssessmentResult } from "./assessment-engine";
import { ASSESSMENT_RETRY_MESSAGE } from "./assessment-result";
import { extractRegistrationFields, isConversationalQuestion, parseRegistrationCapacityAnswer, REGISTRATION_KEYS } from "./registration-input";
import { requestGroqText } from "./groq-ai.server";
import { rankNgosForSurplus } from "./matching-engine";

export { normalizePhone, classify };
export type { InboundMessage, Mode };
export type Channel = "whatsapp" | "admin_simulator";

export interface ConversationInput {
  from: string;
  text: unknown;
  messageSid?: string;
  media?: { url?: string; contentType: string; base64?: string } | null;
  channel: Channel;
}

export interface ConversationMessage {
  id: string;
  who: "user" | "bot";
  text: string;
  imageUrl?: string;
  timestamp: string;
}

export interface ConversationResult {
  reply: string;
  duplicate?: boolean;
  session?: ConversationSessionRow;
}

interface KitchenRow {
  id: string; name: string; contact_name: string | null; phone: string; status: string;
  conversation_state: string; pending_assessment_id: string | null;
  address: string | null; city: string | null; email: string | null;
  organization_type: string | null; operating_hours: string | null; daily_meals: number | null;
}

interface NgoRow {
  id: string; name: string; contact_name: string | null; phone: string; status: string;
  conversation_state: string; pending_surplus_id: string | null; proposed_quantity: number | null;
  address: string | null; city: string | null; distance_km: number | null;
  capacity_meals: number | null; food_requirements: string | null; availability: string | null;
}

interface ConversationSessionRow {
  id: string; phone: string; role: string | null; entity_id: string | null;
  state: string; pending_data: Record<string, unknown>;
  channel: string; created_at: string; updated_at: string;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ──────────────────────────────────────────────
// Menus
// ──────────────────────────────────────────────

export const KITCHEN_MENU = `🌱 *ResQFood AI — Kitchen*

What would you like to do?

1. Register / Complete Profile
2. Report Surplus Food
3. Check My Surplus
4. View Active Matches
5. Request Help
6. Help

Reply with a number or just tell me what you need.`;

export const NGO_MENU = `🤝 *ResQFood AI — NGO / Recipient*

What would you like to do?

1. Register / Complete Profile
2. View Available Food
3. Accept Food
4. Reject Food
5. View My Allocations
6. Delivery Status
7. Help

Reply with a number or just tell me what you need.`;

const KITCHEN_HELP = `ℹ️ *Kitchen Help*

You can:
• Report surplus food — send a photo or say "we have 25 portions of rice"
• Check your donations — "show my surplus"
• View active matches — "any matches?"
• Register / update profile — "register"

Reply "menu" anytime to see options.`;

const NGO_HELP = `ℹ️ *NGO Help*

You can:
• See available food — "show available food" or "what's available?"
• Accept food — "accept" or "we can take 20"
• Reject food — "reject" or "decline"
• View allocations — "my allocations"
• Track delivery — "where is my food?"
• Register / update profile — "register"

Reply "menu" anytime to see options.`;

const DISCLAIMER = "AI visual screening does not guarantee food safety. Final acceptance remains subject to applicable food-safety procedures and provider confirmation.";

// ──────────────────────────────────────────────
// NLU intent detection
// ──────────────────────────────────────────────

const INTENTS = {
  greet: /^(hi+|hello|hey|start|namaste|good (morning|afternoon|evening))\b/i,
  menu: /\b(menu|options|main menu|back)\b/i,
  help: /\b(help|support|guide|what can i do)\b/i,
  register: /\b(register|registration|sign up|signup|create account|complete profile|profile)\b/i,
  reportSurplus: /\b(report|log|add|upload).*(surplus|food|leftover|left over|remaining|extra)|surplus|(we have|got|there (is|are)).*(portions?|meals?|kg|servings?|plates?|left|remaining|extra)\b/i,
  mySurplus: /\b(my surplus|my donations?|my food|what.*(reported|logged|posted)|show my)\b/i,
  activeMatches: /\b(match|matches|ngo.*interested|who.*wants|any takers)\b/i,
  availableFood: /\b(available|what.*food|any food|show food|offers?|surplus|what.*available|list)\b/i,
  accept: /\b(yes|yeah|yep|accept|take|ok|okay|sure|need|give us|want|we can)\b/i,
  reject: /\b(no|nope|reject|decline|cannot|can't|cant|not able|unable|pass)\b/i,
  myAllocations: /\b(allocation|my food list|my requests?|accepted food|what have we|my accepted)\b/i,
  delivery: /\b(deliver|arriv|where.*my.*food|track|eta|driver|status|where.*food)\b/i,
  confirm: /\b(confirm|yes|correct|right|ok|okay|sure|go ahead|done|that's right)\b/i,
  correct: /\b(edit|change|actually|instead|modify|update|correct|wrong|not right)\b/i,
  retry: /\b(retry|retake|redo|another photo|new photo|try again)\b/i,
  kitchen: /\b(kitchen|food provider|restaurant|cafe|canteen|hotel|mess)\b/i,
  ngo: /\b(ngo|recipient|shelter|food bank|orphanage|charity|non-?profit)\b/i,
};

function detectIntent(text: string): string {
  const t = text.trim().toLowerCase();
  if (!t) return "empty";
  for (const [name, re] of Object.entries(INTENTS)) {
    if (re.test(t)) return name;
  }
  // Numeric menu selection
  if (/^\d+$/.test(t)) return "numeric";
  return "unknown";
}

export function normalizeConversationText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const candidate = record["text"] ?? record["body"] ?? record["caption"];
    return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : "";
  }
  return "";
}

export function normalizeConversationMedia(value: unknown, explicit?: ConversationInput["media"]): ConversationInput["media"] {
  if (explicit) return explicit;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const nested = record["image"] ?? record["media"];
  const candidate = nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : record;
  const contentType = candidate["contentType"] ?? candidate["mimeType"];
  const base64 = candidate["base64"] ?? candidate["data"];
  const url = candidate["url"];
  if (typeof contentType !== "string" || !contentType.startsWith("image/")) return null;
  return {
    contentType,
    ...(typeof base64 === "string" ? { base64 } : {}),
    ...(typeof url === "string" ? { url } : {}),
  };
}

export function parseNaturalKitchenDetails(text: string): Record<string, string | number> {
  return extractRegistrationFields(text);
}

function modelSafeText(text: string): string {
  return text.slice(0, 500)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email omitted]")
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, "[phone omitted]");
}

async function recentAssistantContext(phone: string): Promise<string> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("direction, message_text")
      .eq("from_phone", phone)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(12);
    if (error) return "";
    return (data ?? [])
      .map((row) => row.message_text)
      .filter((message): message is string => typeof message === "string" && Boolean(message.trim()))
      .slice(0, 4)
      .reverse()
      .map((message) => modelSafeText(message).slice(0, 240))
      .join("\n");
  } catch {
    return "";
  }
}

export async function interpretRegistrationReply(text: string, role: string, currentKey: string, phone: string): Promise<Record<string, string | number>> {
  const fallback = extractRegistrationFields(text);
  if (role === "ngo" && fallback["daily_meals"] !== undefined) {
    fallback["capacity_meals"] = fallback["daily_meals"];
    delete fallback["daily_meals"];
  }
  if (!process.env["GROQ_API_KEY"] || !text.trim() || currentKey === "email") return fallback;
  try {
    const context = await recentAssistantContext(phone);
    const response = await requestGroqText({
      instructions: `Interpret a ResQFood ${role} registration reply. Return only JSON object with keys from ${REGISTRATION_KEYS.join(", ")} and optional "question" boolean. Use only information explicitly present in the user's message; never infer missing facts. Extract fields from natural language. Do not perform actions or claim anything was saved.`,
      input: `Current field: ${currentKey}. Recent assistant messages:\n${context}\nCurrent user message: ${modelSafeText(text)}`,
      json: true,
      maxOutputTokens: 180,
    });
    if (!response.ok) return fallback;
    const parsed = JSON.parse(response.text) as Record<string, unknown>;
    const fields: Record<string, string | number> = { ...fallback };
    for (const key of REGISTRATION_KEYS) {
      const value = parsed[key];
      if ((typeof value === "string" || typeof value === "number") && String(value).trim()) {
        const target = role === "ngo" && key === "daily_meals" ? "capacity_meals" : key;
        // Accept only extracted text that is actually present in the user's message.
        if (text.toLocaleLowerCase().includes(String(value).toLocaleLowerCase())) fields[target] = value;
        if ((target === "daily_meals" || target === "capacity_meals") && typeof value === "number" && Number.isInteger(value) && value > 0) fields[target] = value;
      }
    }
    if (parsed["question"] === true) fields["__question"] = 1;
    return fields;
  } catch {
    return fallback;
  }
}

async function gptConversationalReply(text: string, role: string | null, state: string, phone: string): Promise<string | null> {
  if (!process.env["GROQ_API_KEY"] || !text.trim()) return null;
  try {
    const context = await recentAssistantContext(phone);
    const response = await requestGroqText({
      instructions: "You are the ResQFood AI WhatsApp assistant. Answer briefly and helpfully using only the current app context. Do not claim registrations, database writes, food safety approvals, allocations, acceptances, deliveries, or other actions succeeded. If uncertain, say so and direct the person to the menu. Never request passwords, API keys, or payment details.",
      input: `Current participant role: ${role ?? "unregistered"}. Workflow state: ${state}. Recent assistant messages:\n${context}\nCurrent user message: ${modelSafeText(text)}`,
      maxOutputTokens: 120,
    });
    if (!response.ok) return null;
    return response.text.slice(0, 600);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Session helpers
// ──────────────────────────────────────────────

async function getOrCreateSession(phone: string, channel: Channel): Promise<ConversationSessionRow> {
  const supabase = await db();
  const { data: existing } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) return existing as ConversationSessionRow;

  const { data, error } = await supabase
    .from("conversation_sessions")
    .insert({ phone, state: "new", channel, pending_data: {} })
    .select("*")
    .single();
  if (error) throw new Error(`Session create failed: ${error.message}`);
  return data as ConversationSessionRow;
}

async function updateSession(session: ConversationSessionRow, patch: Partial<ConversationSessionRow>) {
  const supabase = await db();
  const { error } = await supabase
    .from("conversation_sessions")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", session.id);
  if (error) throw new Error(`Session update failed: ${error.message}`);
  Object.assign(session, patch);
}

async function setSessionData(session: ConversationSessionRow, data: Record<string, unknown>) {
  const merged = { ...session.pending_data, ...data };
  await updateSession(session, { pending_data: merged });
}

// ──────────────────────────────────────────────
// Entity lookups
// ──────────────────────────────────────────────

async function findKitchen(phone: string): Promise<KitchenRow | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("kitchens").select("*").eq("phone", phone).maybeSingle();
  if (error) throw new Error(error.message);
  return data as KitchenRow | null;
}

async function findNgo(phone: string): Promise<NgoRow | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("ngos").select("*").eq("phone", phone).maybeSingle();
  if (error) throw new Error(error.message);
  return data as NgoRow | null;
}

// ──────────────────────────────────────────────
// Message logging
// ──────────────────────────────────────────────

async function logMessage(row: {
  kitchen_id: string | null; ngo_id?: string | null; from_phone: string;
  provider_message_id?: string | null; message_type: string; message_text: string | null;
  media_reference?: string | null; direction: "inbound" | "outbound"; mode: Mode;
}) {
  const supabase = await db();
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .insert(row)
    .select("id")
    .single();
  if (error) throw new Error(`Failed to log message: ${error.message}`);
  return data.id as string;
}

// ──────────────────────────────────────────────
// Registration field definitions
// ──────────────────────────────────────────────

const KITCHEN_REG_FIELDS: { key: string; prompt: string }[] = [
  { key: "name", prompt: "What is your kitchen / business name?" },
  { key: "contact_name", prompt: "Who should we contact? (contact person name)" },
  { key: "email", prompt: "What is your email address? (reply 'skip' if none)" },
  { key: "address", prompt: "What is your kitchen address?" },
  { key: "city", prompt: "Which city are you in?" },
  { key: "organization_type", prompt: "What type of organization? (e.g. restaurant, cafeteria, hotel, hospital, school)" },
  { key: "operating_hours", prompt: "What are your operating hours? (e.g. 8 AM – 10 PM)" },
  { key: "daily_meals", prompt: "Approximately how many meals do you serve daily?" },
];

const NGO_REG_FIELDS: { key: string; prompt: string }[] = [
  { key: "name", prompt: "What is your organization name?" },
  { key: "contact_name", prompt: "Who should we contact? (contact person name)" },
  { key: "email", prompt: "What is your email address? (reply 'skip' if none)" },
  { key: "address", prompt: "What is your organization address?" },
  { key: "city", prompt: "Which city are you in?" },
  { key: "organization_type", prompt: "What type of organization? (e.g. shelter, food bank, orphanage, charity)" },
  { key: "capacity_meals", prompt: "How many beneficiaries / meals can you accommodate?" },
  { key: "food_requirements", prompt: "Any food requirements or preferences? (e.g. vegetarian only, no pork, any food)" },
  { key: "availability", prompt: "What are your receiving hours? (e.g. 8 AM – 9 PM, 24 hours)" },
];

// ──────────────────────────────────────────────
// Registration state machine
// ──────────────────────────────────────────────

async function handleRegistration(
  session: ConversationSessionRow,
  text: string,
  type: string,
): Promise<string> {
  const data = session.pending_data ?? {};
  const role = session.role;

  // Step 1: role selection
  if (session.state === "reg_select_role") {
    const intent = detectIntent(text);
    if (intent === "kitchen" || text.trim() === "1") {
      await updateSession(session, { role: "kitchen", state: "reg_collecting" });
      return `Great! Let's register your kitchen.\n\n${KITCHEN_REG_FIELDS[0].prompt}`;
    }
    if (intent === "ngo" || text.trim() === "2") {
      await updateSession(session, { role: "ngo", state: "reg_collecting" });
      return `Great! Let's register your NGO.\n\n${NGO_REG_FIELDS[0].prompt}`;
    }
    return "Please reply 1 for Kitchen or 2 for NGO.";
  }

  // Step 2: collect fields
  if (session.state === "reg_collecting") {
    const fields = role === "kitchen" ? KITCHEN_REG_FIELDS : NGO_REG_FIELDS;
    const currentIndex = (data.reg_index as number) ?? 0;

    // Store the answer for the current field
    const currentField = fields[currentIndex];
    if (currentField) {
      const trimmed = text.trim();
      if (!trimmed) return `I didn't receive an answer.\n\n${currentField.prompt}`;
      if (isConversationalQuestion(trimmed)) {
        const answer = await gptConversationalReply(trimmed, role ?? null, session.state, session.phone);
        return `${answer ?? "I can help with registration. You can ask for clarification, or answer this field when ready."}\n\n${currentField.prompt}`;
      }
      const extracted = await interpretRegistrationReply(trimmed, role ?? "user", currentField.key, session.phone);
      if (extracted["__question"]) return `I can help with that. Your registration is saved as you go.\n\n${currentField.prompt}`;
      const updates: Record<string, unknown> = {};
      for (const key of REGISTRATION_KEYS) {
        if (!(key in extracted)) continue;
        const candidate = extracted[key];
        if (key === "daily_meals" || key === "capacity_meals") {
          const n = parseRegistrationCapacityAnswer(trimmed, candidate);
          if (!n) {
            if (key === currentField.key) return `Please enter a whole number only (for example, 50).\n\n${currentField.prompt}`;
            continue;
          }
          updates[key] = n;
        } else if (typeof candidate === "string") {
          updates[key] = candidate.trim();
        }
      }
      if (trimmed.toLowerCase() === "skip" && ["email", "food_requirements"].includes(currentField.key)) updates[currentField.key] = "";
      if (["daily_meals", "capacity_meals"].includes(currentField.key) && !(currentField.key in updates)) {
        const capacity = parseRegistrationCapacityAnswer(trimmed, extracted[currentField.key]);
        if (!capacity) return `Please enter a positive whole number of meals only (for example, 50).\n\n${currentField.prompt}`;
        updates[currentField.key] = capacity;
      }
      if (!(currentField.key in updates) && !("__question" in extracted) && Object.keys(extracted).length === 0) updates[currentField.key] = trimmed;
      if (!(currentField.key in updates) && Object.keys(updates).length === 0) {
        const answer = await gptConversationalReply(trimmed, role ?? null, session.state, session.phone);
        return `${answer ?? "I couldn't identify an answer for that field."}\n\n${currentField.prompt}`;
      }
      const merged = { ...data, ...updates };
      let nextIndex = 0;
      while (nextIndex < fields.length && String(merged[fields[nextIndex].key] ?? "").trim()) nextIndex++;
      await setSessionData(session, { ...updates, reg_index: nextIndex });
      if (nextIndex !== currentIndex + 1) {
        return `I noted the details you provided.\n\n${fields[nextIndex]?.prompt ?? ""}`;
      }
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < fields.length) {
      return fields[nextIndex].prompt;
    }

    // All fields collected — create the entity
    return await finalizeRegistration(session);
  }

  return KITCHEN_MENU;
}

async function finalizeRegistration(session: ConversationSessionRow): Promise<string> {
  const supabase = await db();
  const data = session.pending_data ?? {};
  const role = session.role;

  if (role === "kitchen") {
    const insertData: Record<string, unknown> = {
      name: data.name,
      contact_name: data.contact_name || null,
      phone: session.phone,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      organization_type: data.organization_type || null,
      operating_hours: data.operating_hours || null,
      daily_meals: data.daily_meals || null,
      status: "pending",
      conversation_state: "idle",
      reg_data: data,
    };

    const { data: kitchen, error } = await supabase
      .from("kitchens")
      .insert(insertData)
      .select("*")
      .single();
    if (error) throw new Error(`Registration failed: ${error.message}`);

    await updateSession(session, {
      entity_id: (kitchen as { id: string }).id,
      state: "idle",
      pending_data: {},
    });

    return `✅ *Registration Submitted!*

Kitchen: ${data.name}
Contact: ${data.contact_name || "—"}
City: ${data.city || "—"}

Verification status: *Pending*

We'll notify you once your registration is approved. You can then start reporting surplus food.`;
  }

  if (role === "ngo") {
    const insertData: Record<string, unknown> = {
      name: data.name,
      contact_name: data.contact_name || null,
      phone: session.phone,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      organization_type: data.organization_type || null,
      capacity_meals: data.capacity_meals || null,
      food_requirements: data.food_requirements || null,
      availability: data.availability || null,
      status: "pending",
      conversation_state: "idle",
      reg_data: data,
    };

    const { data: ngo, error } = await supabase
      .from("ngos")
      .insert(insertData)
      .select("*")
      .single();
    if (error) throw new Error(`Registration failed: ${error.message}`);

    await updateSession(session, {
      entity_id: (ngo as { id: string }).id,
      state: "idle",
      pending_data: {},
    });

    return `✅ *Registration Submitted!*

NGO: ${data.name}
Contact: ${data.contact_name || "—"}
City: ${data.city || "—"}
Capacity: ${data.capacity_meals || "—"} meals

Verification status: *Pending*

We'll notify you once your registration is approved. You can then browse and accept available food.`;
  }

  return "Registration complete.";
}

// ──────────────────────────────────────────────
// Kitchen surplus flow
// ──────────────────────────────────────────────

async function handleKitchenSurplus(
  session: ConversationSessionRow,
  kitchen: KitchenRow,
  text: string,
  type: string,
  media: ConversationInput["media"],
  inboundId: string,
): Promise<string> {
  const supabase = await db();
  const data = session.pending_data ?? {};

  // State: awaiting_food_name
  if (session.state === "surplus_awaiting_food_name") {
    const foodName = text.trim();
    if (!foodName) return "What food do you have? Please tell me the food name.";
    await setSessionData(session, { food_name: foodName });
    await updateSession(session, { state: "surplus_awaiting_quantity" });
    return `Got it: ${foodName}.\nHow much food do you have? (e.g. "25 portions" or "10 kg")`;
  }

  // State: awaiting_quantity
  if (session.state === "surplus_awaiting_quantity") {
    const n = parseQuantity(text);
    if (!n) return "Please tell me the quantity as a number, e.g. 25 portions or 10 kg.";
    const unit = /kg/i.test(text) ? "kg" : "portions";
    await setSessionData(session, { quantity: n, unit });
    await updateSession(session, { state: "surplus_awaiting_photo" });
    return `Got it: ${n} ${unit} of ${data.food_name}.\n\nPlease send a photo of the food for AI assessment. 📷`;
  }

  // State: awaiting_photo — text message
  if (session.state === "surplus_awaiting_photo" && type === "text") {
    const intent = detectIntent(text);
    if (intent === "retry" || intent === "menu") {
      await updateSession(session, { state: "idle" });
      return KITCHEN_MENU;
    }
    return `Please send a photo of the ${data.food_name ?? "food"} for AI assessment. 📷\n\nReply "menu" to cancel.`;
  }

  // State: awaiting_photo — image received
  if (session.state === "surplus_awaiting_photo" && type === "image") {
    return await processFoodAssessment(session, kitchen, media, inboundId);
  }

  // State: awaiting_confirmation
  if (session.state === "surplus_awaiting_confirmation") {
    const pendingId = data.assessment_id as string;
    if (!pendingId) {
      await updateSession(session, { state: "idle" });
      return KITCHEN_MENU;
    }

    const { data: assessment } = await supabase
      .from("food_assessments")
      .select("*")
      .eq("id", pendingId)
      .maybeSingle();
    if (!assessment) {
      await updateSession(session, { state: "idle" });
      return "Assessment not found. Please report surplus again.";
    }

    const intent = detectIntent(text);
    const t = text.trim().toLowerCase();

    // Confirm
    if (t === "1" || intent === "confirm") {
      return await confirmAssessment(session, kitchen, assessment);
    }
    // Correct quantity
    if (t === "2" || intent === "correct" && /quant/i.test(text)) {
      await updateSession(session, { state: "surplus_correcting_quantity" });
      return "What is the correct quantity? (e.g. 30 portions)";
    }
    // Correct food name
    if (t === "3") {
      await updateSession(session, { state: "surplus_correcting_food" });
      return "What is the correct food name?";
    }
    // Reject / retake
    if (t === "4" || intent === "retry" || intent === "reject") {
      await supabase
        .from("food_assessments")
        .update({ confirmation_status: "rejected_by_kitchen" })
        .eq("id", pendingId);
      await updateSession(session, { state: "surplus_awaiting_photo", pending_data: { food_name: data.food_name, quantity: data.quantity, unit: data.unit } });
      return "❌ Assessment rejected. Please send a new photo. 📷";
    }

    return `Please reply:\n1. Confirm\n2. Correct quantity\n3. Correct food name\n4. Reject / Retake photo`;
  }

  // State: correcting_quantity
  if (session.state === "surplus_correcting_quantity") {
    const n = parseQuantity(text);
    if (!n) return "Please enter the correct quantity as a number, e.g. 30.";
    const pendingId = data.assessment_id as string;
    await supabase
      .from("food_assessments")
      .update({ confirmed_quantity: n, confirmation_status: "awaiting_confirmation" })
      .eq("id", pendingId);
    await setSessionData(session, { confirmed_quantity: n });
    await updateSession(session, { state: "surplus_awaiting_confirmation" });
    return `Updated quantity: ${n} portions.\n\nPlease confirm:\n1. Confirm\n2. Correct quantity\n3. Correct food name\n4. Reject / Retake photo`;
  }

  // State: correcting_food
  if (session.state === "surplus_correcting_food") {
    const foodName = text.trim();
    if (!foodName) return "Please tell me the correct food name.";
    const pendingId = data.assessment_id as string;
    await supabase
      .from("food_assessments")
      .update({ food_name: foodName })
      .eq("id", pendingId);
    await setSessionData(session, { food_name: foodName });
    await updateSession(session, { state: "surplus_awaiting_confirmation" });
    return `Updated food: ${foodName}.\n\nPlease confirm:\n1. Confirm\n2. Correct quantity\n3. Correct food name\n4. Reject / Retake photo`;
  }

  // State: awaiting_storage_info
  if (session.state === "surplus_awaiting_storage") {
    const storageCondition = text.trim();
    await setSessionData(session, { storage_condition: storageCondition });
    // Compute usable window and persist surplus
    return await finalizeSurplus(session, kitchen, storageCondition);
  }

  return KITCHEN_MENU;
}

function parseQuantity(text: string): number | null {
  const m = text.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return n;
}

async function processFoodAssessment(
  session: ConversationSessionRow,
  kitchen: KitchenRow,
  media: ConversationInput["media"],
  inboundId: string,
): Promise<string> {
  const supabase = await db();
  const data = session.pending_data ?? {};

  let analysis: AssessmentResult;
  let imageRef = media?.url ?? "inline-upload";
  let assessmentStage: "media_download" | "groq_request" = media?.base64 ? "groq_request" : "media_download";

  try {
    const mediaData = media!.base64
      ? { base64: media!.base64, contentType: media!.contentType }
      : null;
    if (!mediaData) {
      // Need to download from Twilio URL
      const { downloadTwilioMedia } = await import("./pipeline.server");
      const downloaded = await downloadTwilioMedia(media!.url!);
      assessmentStage = "groq_request";
      analysis = await analyzeFoodImage(downloaded.base64, downloaded.contentType, {
        foodName: data.food_name as string | undefined,
        userQuantity: data.quantity as number | undefined,
      });
    } else {
      analysis = await analyzeFoodImage(mediaData.base64, mediaData.contentType, {
        foodName: data.food_name as string | undefined,
        userQuantity: data.quantity as number | undefined,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const statusMatch = message.match(/\[(\d{3})\]/);
    const status = statusMatch ? Number(statusMatch[1]) : null;
    const category = /GROQ_API_KEY missing/.test(message)
      ? "missing_groq_key"
      : /not configured/.test(message)
        ? "media_credentials_missing"
        : assessmentStage === "groq_request" && status === 404
          ? "model_not_found"
        : status !== null
          ? "upstream_http_error"
          : error instanceof Error && error.name === "TimeoutError"
            ? "timeout"
            : assessmentStage === "media_download"
              ? "media_retrieval_error"
              : error instanceof SyntaxError
                ? "invalid_model_json"
                : /structured|invalid|omitted|identify|estimate|confidence|screening|visual quality/i.test(message)
                  ? "invalid_model_result"
                  : "model_request_error";
    console.error("[WhatsApp assessment] Failed", JSON.stringify({ stage: assessmentStage, category, httpStatus: status }));
    return ASSESSMENT_RETRY_MESSAGE;
  }

  // Persist assessment
  const { data: assessment, error } = await supabase
    .from("food_assessments")
    .insert({
      kitchen_id: kitchen.id,
      message_id: inboundId,
      image_reference: imageRef,
      food_name: analysis.food_name,
      ai_estimated_quantity: analysis.estimated_portions,
      ai_estimated_weight: analysis.estimated_weight_kg,
      quality_screening_status: analysis.quality_screening_status,
      assessment_note: `${analysis.assessment_note} Limitations: ${analysis.limitations.join("; ")}`.slice(0, 300),
      analysis_mode: analysis.analysis_mode,
      model: analysis.model,
      visual_quality: analysis.visual_quality,
      freshness: analysis.freshness,
      confidence_percent: analysis.confidence_percent,
      safety_status: analysis.safety_status,
      confirmation_status: "awaiting_confirmation",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await setSessionData(session, { assessment_id: (assessment as { id: string }).id });
  await updateSession(session, { state: "surplus_awaiting_confirmation" });

  // Update kitchen conversation state for backward compat
  await supabase
    .from("kitchens")
    .update({ conversation_state: "awaiting_confirmation", pending_assessment_id: (assessment as { id: string }).id })
    .eq("id", kitchen.id);

  return formatAssessmentMessage(analysis);
}

function formatAssessmentMessage(a: AssessmentResult): string {
  const lines = [
    "📸 *AI Assessment Complete*",
    "",
    `🍚 Food: ${a.food_name}`,
    `📦 Estimated quantity: ~${a.estimated_portions} portions`,
  ];
  if (a.estimated_weight_kg > 0) lines.push(`⚖️ Estimated weight: ~${a.estimated_weight_kg} kg`);
  lines.push(`👁 Visual quality: ${a.visual_quality}`);
  lines.push(`🕒 Freshness: ${a.freshness}`);
  if (a.confidence_percent > 0) lines.push(`🎯 Confidence: ${a.confidence_percent}%`);
  lines.push(`✅ Assessment: ${a.quality_screening_status}`);
  if (a.assessment_note) lines.push("", a.assessment_note);
  if (a.limitations.length) lines.push(`Limitations: ${a.limitations.join("; ")}`);
  lines.push(
    "",
    "Is this correct?",
    "",
    "1. Confirm",
    "2. Correct quantity",
    "3. Correct food",
    "4. Reject / Retake photo",
    "",
    `ℹ️ ${DISCLAIMER}`,
  );
  return lines.join("\n");
}

async function confirmAssessment(
  session: ConversationSessionRow,
  kitchen: KitchenRow,
  assessment: Record<string, unknown>,
): Promise<string> {
  const supabase = await db();
  const data = session.pending_data ?? {};
  const qty = (data.confirmed_quantity as number) ?? (assessment.confirmed_quantity as number) ?? (assessment.ai_estimated_quantity as number) ?? 0;
  const foodName = (data.food_name as string) ?? (assessment.food_name as string);

  await supabase
    .from("food_assessments")
    .update({
      confirmed_quantity: qty,
      confirmation_status: (data.confirmed_quantity as number) != null ? "corrected_confirmed" : "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", assessment.id as string);

  // Ask about storage condition for usable window
  await updateSession(session, { state: "surplus_awaiting_storage" });
  return `✅ Assessment confirmed: ${qty} portions of ${foodName}.\n\nHow is the food currently stored? (e.g. "hot", "refrigerated", "room temperature")`;
}

async function finalizeSurplus(
  session: ConversationSessionRow,
  kitchen: KitchenRow,
  storageCondition: string,
): Promise<string> {
  const supabase = await db();
  const data = session.pending_data ?? {};
  const assessmentId = data.assessment_id as string;
  const qty = (data.confirmed_quantity as number) ?? (data.quantity as number) ?? 0;
  const foodName = (data.food_name as string) ?? "Unknown";
  const unit = (data.unit as string) ?? "portions";
  const weight = await getAssessmentWeight(assessmentId);

  // Compute usable window
  const windowHours = computeUsableWindow(foodName, storageCondition);
  const usableUntil = new Date(Date.now() + windowHours * 3_600_000).toISOString();
  const urgency = windowHours <= 2 ? "HIGH" : windowHours <= 1 ? "URGENT" : "NORMAL";

  // Persist surplus
  const { data: surplus, error } = await supabase
    .from("surplus_food")
    .upsert(
      {
        kitchen_id: kitchen.id,
        assessment_id: assessmentId,
        food_name: foodName,
        quantity: qty,
        unit,
        estimated_weight_kg: weight,
        state: "ASSESSMENT_COMPLETE",
        usable_until: usableUntil,
        urgency,
        source: session.channel,
        created_channel: session.channel,
      },
      { onConflict: "assessment_id" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Run matching engine
  const matches = await rankNgosForSurplus((surplus as { id: string }).id);

  // Update assessment with storage info
  await supabase
    .from("food_assessments")
    .update({ storage_condition: storageCondition, usable_window_hours: windowHours })
    .eq("id", assessmentId);

  // Reset session to idle
  await updateSession(session, { state: "idle", pending_data: {} });
  await supabase
    .from("kitchens")
    .update({ conversation_state: "idle", pending_assessment_id: null })
    .eq("id", kitchen.id);

  const windowText = `Approximately ${windowHours} hour${windowHours !== 1 ? "s" : ""} based on the information provided.\nThis is an operational estimate, not a food-safety guarantee.`;

  let matchText = "";
  if (matches.length > 0) {
    matchText = `\n\n🔍 *${matches.length} NGO${matches.length > 1 ? "s" : ""} matched:*\n`;
    matchText += matches.slice(0, 3).map((m, i) => `${i + 1}. ${m.ngo_name} — ${m.total_score.toFixed(0)}% match, ${m.distance_km?.toFixed(1) ?? "?"} km`).join("\n");
    matchText += "\n\nNearby NGOs will be notified.";
  } else {
    matchText = "\n\nNo verified NGOs found nearby yet. We'll notify you when a match is found.";
  }

  return `✅ *Surplus Recorded*\n\nFood: ${foodName}\nQuantity: ${qty} ${unit}\nEstimated weight: ~${weight} kg\n\n⏱️ *Estimated usable window:*\n${windowText}${matchText}`;
}

async function getAssessmentWeight(assessmentId: string): Promise<number> {
  const supabase = await db();
  const { data } = await supabase
    .from("food_assessments")
    .select("ai_estimated_weight")
    .eq("id", assessmentId)
    .maybeSingle();
  return data?.ai_estimated_weight ? Number(data.ai_estimated_weight) : 0;
}

function computeUsableWindow(foodName: string, storageCondition: string): number {
  const cond = storageCondition.toLowerCase();
  // Hot holding: shorter window
  if (cond.includes("hot")) return 3;
  // Refrigerated: longer window
  if (cond.includes("refrig") || cond.includes("cold") || cond.includes("chill")) return 8;
  // Room temperature: shortest
  if (cond.includes("room") || cond.includes("ambient")) return 2;
  // Default
  return 4;
}

// ──────────────────────────────────────────────
// Kitchen: my surplus
// ──────────────────────────────────────────────

async function showMySurplus(kitchen: KitchenRow): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("surplus_food")
    .select("food_name, quantity, unit, state, created_at, urgency")
    .eq("kitchen_id", kitchen.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  if (!data?.length) return "You haven't reported any surplus food yet. Reply \"report surplus\" to add some.";
  const lines = ["📋 *Your recent surplus:*", ""];
  for (const r of data) {
    lines.push(`• ${r.food_name} — ${r.quantity} ${r.unit} — ${r.state}${r.urgency ? ` (${r.urgency})` : ""}`);
  }
  return lines.join("\n");
}

async function showActiveMatches(kitchen: KitchenRow): Promise<string> {
  const supabase = await db();
  const { data: surplus, error: sErr } = await supabase
    .from("surplus_food")
    .select("id, food_name, quantity, unit, state")
    .eq("kitchen_id", kitchen.id)
    .in("state", ["ASSESSMENT_COMPLETE", "AVAILABLE", "NGO_NOTIFIED", "ALLOCATED"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (sErr) throw new Error(sErr.message);
  if (!surplus?.length) return "No active matches. Your surplus food hasn't been matched to any NGOs yet.";

  const lines = ["🔍 *Active matches:*", ""];
  for (const s of surplus) {
    const { data: matches } = await supabase
      .from("ngo_matches")
      .select("total_score, rank, ngos(name, distance_km)")
      .eq("surplus_id", s.id)
      .order("rank", { ascending: true })
      .limit(3);
    lines.push(`📦 ${s.food_name} — ${s.quantity} ${s.unit} — ${s.state}`);
    if (matches?.length) {
      for (const m of matches) {
        const ngo = m.ngos as { name: string; distance_km: number | null } | null;
        lines.push(`   ${m.rank}. ${ngo?.name ?? "?"} — ${Number(m.total_score).toFixed(0)}% match`);
      }
    } else {
      lines.push("   No NGO matches yet.");
    }
  }
  return lines.join("\n");
}

// ──────────────────────────────────────────────
// NGO flow (delegates to ngo.server.ts for existing logic)
// ──────────────────────────────────────────────

async function handleNgoMessage(
  session: ConversationSessionRow,
  ngo: NgoRow,
  text: string,
  type: string,
): Promise<string> {
  // Delegate to the existing NGO router for the core offer/accept/reject flow
  const { routeNgo } = await import("./ngo.server");
  return routeNgo(ngo, type, text);
}

// ──────────────────────────────────────────────
// Main entry point
// ──────────────────────────────────────────────

export async function processConversation(input: ConversationInput): Promise<ConversationResult> {
  const supabase = await db();
  const phone = normalizePhone(input.from);
  const text = normalizeConversationText(input.text);
  const media = normalizeConversationMedia(input.text, input.media);
  const type = media ? classify(text, media) : "text";
  const channel = input.channel;

  // Deduplicate by messageSid for live WhatsApp
  if (input.messageSid) {
    const { data: dup } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("provider_message_id", input.messageSid)
      .maybeSingle();
    if (dup) return { reply: "", duplicate: true };
  }

  // Get or create session
  const session = await getOrCreateSession(phone, channel);

  // Look up existing entities
  const kitchen = session.role === "kitchen" && session.entity_id
    ? await findKitchen(phone)
    : session.role === "ngo" && session.entity_id
      ? null
      : await findKitchen(phone);
  const ngo = session.role === "ngo" && session.entity_id
    ? await findNgo(phone)
    : session.role === "kitchen"
      ? null
      : kitchen ? null : await findNgo(phone);

  // Log inbound
  const inboundId = await logMessage({
    kitchen_id: kitchen?.id ?? null,
    ngo_id: ngo?.id ?? null,
    from_phone: phone,
    provider_message_id: input.messageSid ?? null,
    message_type: type,
    message_text: text || null,
    media_reference: media?.url ?? (media ? "inline-upload" : null),
    direction: "inbound",
    mode: channel === "whatsapp" ? "live" : "demo",
  });

  // Route through the state machine
  let reply: string;
  try {
    reply = await routeMessage(session, kitchen, ngo, text, type, media, inboundId, phone);
    const genericReply = reply === KITCHEN_MENU || reply === NGO_MENU || reply.includes('Reply "hi" to get started') || reply.includes('Reply "register" to get started');
    const safeFallback = reply.startsWith("Sorry, I didn't understand") || reply.startsWith("You're not registered yet.");
    if ((genericReply || safeFallback) && type === "text") {
      const conversational = await gptConversationalReply(text, session.role, session.state, session.phone);
      if (conversational) reply = `${conversational}\n\n${reply}`;
    }
  } catch (e) {
    const details = safeErrorDetails(e);
    console.error("[WhatsApp simulator] Conversation processing failed:", details);
    reply = process.env["NODE_ENV"] === "development"
      ? `Simulator processing error: ${details}`
      : "Sorry, something went wrong while processing your message. Please try again.";
  }

  // Log outbound
  await logMessage({
    kitchen_id: kitchen?.id ?? null,
    ngo_id: ngo?.id ?? null,
    from_phone: phone,
    message_type: "text",
    message_text: reply,
    direction: "outbound",
    mode: channel === "whatsapp" ? "live" : "demo",
  });

  return { reply, session };
}

/** Return a short diagnostic without exposing keys, bearer tokens, or stacks. */
export function safeErrorDetails(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  let message = error instanceof Error ? error.message : String(error);
  const configuredSecrets = [
    process.env["SUPABASE_SERVICE_ROLE_KEY"],
    process.env["SUPABASE_PUBLISHABLE_KEY"],
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
    process.env["TWILIO_API_KEY"],
    process.env["TWILIO_AUTH_TOKEN"],
    process.env["WHATSAPP_WEBHOOK_TOKEN"],
    process.env["GROQ_API_KEY"],
    process.env["WEATHER_API_KEY"],
    process.env["OPENAI_API_KEY"],
  ].filter((value): value is string => Boolean(value && value.length >= 8));
  for (const secret of configuredSecrets) message = message.replaceAll(secret, "[redacted]");
  message = message
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+/g, "[redacted key]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/https?:\/\/[^\s:@/]+:[^\s@/]+@/gi, "[redacted URL]@");
  return `${name}: ${message.slice(0, 300)}`;
}

async function routeMessage(
  session: ConversationSessionRow,
  kitchen: KitchenRow | null,
  ngo: NgoRow | null,
  text: string,
  type: string,
  media: ConversationInput["media"],
  inboundId: string,
  phone: string,
): Promise<string> {
  const intent = detectIntent(text);
  const t = text.trim().toLowerCase();

  // ── Voice handling (not yet supported) ──
  if (type === "voice") {
    return "🎙️ Voice transcription is not configured yet. Please type your message or send a photo.";
  }

  // ── Unknown media type ──
  if (type === "unknown") {
    return "Sorry, this message type is not supported. Please send a text message or a photo.";
  }

  // ── NEW: unregistered phone ──
  if (!kitchen && !ngo) {
    // If in registration flow, continue it
    if (session.state === "reg_select_role" || session.state === "reg_collecting") {
      return handleRegistration(session, text, type);
    }

    // If image received from unregistered user
    if (type === "image") {
      return "👋 Welcome to ResQFood AI!\n\nYou're not registered yet. Please register first to start reporting surplus food.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient\n\nReply 1 or 2.";
    }

    // Check if user wants to register
    if (intent === "register" || session.state === "new" || intent === "greet") {
      await updateSession(session, { state: "reg_select_role" });
      return "🌱 *Welcome to ResQFood AI!*\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient\n\nReply 1 or 2.";
    }

    // Any other message from unregistered user → prompt registration
    if (session.state === "new") {
      await updateSession(session, { state: "reg_select_role" });
      return "👋 Welcome to ResQFood AI!\n\nYou're not registered yet. Let's get you started.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient\n\nReply 1 or 2.";
    }

    return "You're not registered yet. Reply \"register\" to get started, or reply \"hi\".";
  }

  // ── REGISTERED: Kitchen ──
  if (kitchen) {
    // If in registration flow (completing profile), handle it
    if (session.state === "reg_collecting") {
      return handleRegistration(session, text, type);
    }

    // If in surplus flow, handle it
    if (session.state.startsWith("surplus_")) {
      return handleKitchenSurplus(session, kitchen, text, type, media, inboundId);
    }

    // Pending approval
    if (kitchen.status !== "approved") {
      return "Your kitchen registration is still pending approval. We'll message you once it's approved.";
    }

    // Global intents
    if (intent === "greet" || intent === "menu" || t === "menu") {
      await updateSession(session, { state: "idle" });
      return KITCHEN_MENU;
    }
    if (intent === "help" || (session.state === "idle" && t === "6")) {
      return KITCHEN_HELP;
    }
    if (intent === "register") {
      await updateSession(session, { state: "reg_select_role" });
      return `Let's update your registration.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient`;
    }

    // Numeric menu
    if (intent === "numeric") {
      const n = t;
      if (n === "1") {
        await updateSession(session, { state: "reg_select_role" });
        return `Let's update your registration.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient`;
      }
      if (n === "2") {
        await updateSession(session, { state: "surplus_awaiting_food_name", pending_data: {} });
        return "I can help you report surplus food.\n\nWhat food do you have available?";
      }
      if (n === "3") return showMySurplus(kitchen);
      if (n === "4") return showActiveMatches(kitchen);
      if (n === "5") return "What do you need help with? Describe your issue and our team will assist you.";
      if (n === "6") return KITCHEN_HELP;
    }

    // Natural language: report surplus
    if (intent === "reportSurplus") {
      // Try to extract food name and quantity from the message
      const extracted = extractFoodAndQuantity(text);
      await setSessionData(session, extracted);
      if (extracted.food_name && extracted.quantity) {
        await updateSession(session, { state: "surplus_awaiting_photo" });
        return `Got it: ${extracted.quantity} ${extracted.unit ?? "portions"} of ${extracted.food_name}.\n\nPlease send a photo of the food for AI assessment. 📷`;
      }
      if (extracted.food_name) {
        await updateSession(session, { state: "surplus_awaiting_quantity" });
        return `Got it: ${extracted.food_name}.\nHow much food do you have? (e.g. "25 portions" or "10 kg")`;
      }
      await updateSession(session, { state: "surplus_awaiting_food_name", pending_data: {} });
      return "I can help you report surplus food.\n\nWhat food do you have available?";
    }

    if (intent === "mySurplus") return showMySurplus(kitchen);
    if (intent === "activeMatches") return showActiveMatches(kitchen);

    // Image received outside surplus flow → start surplus with image
    if (type === "image") {
      await updateSession(session, { state: "surplus_awaiting_photo", pending_data: {} });
      return await processFoodAssessment(session, kitchen, media, inboundId);
    }

    // Default idle response
    if (session.state === "idle") {
      return KITCHEN_MENU;
    }

    return KITCHEN_MENU;
  }

  // ── REGISTERED: NGO ──
  if (ngo) {
    // If in registration flow (completing profile), handle it
    if (session.state === "reg_collecting") {
      return handleRegistration(session, text, type);
    }

    // If in NGO offer/accept flow, delegate to ngo.server
    if (session.state === "offer" || session.state === "confirm" || session.state === "awaiting_quantity") {
      return handleNgoMessage(session, ngo, text, type);
    }

    // Pending approval
    if (ngo.status !== "approved") {
      return "Your NGO registration is still pending approval. We'll message you once it's approved.";
    }

    // Global intents
    if (intent === "greet" || intent === "menu" || t === "menu") {
      await updateSession(session, { state: "idle" });
      return NGO_MENU;
    }
    if (intent === "help" || (session.state === "idle" && t === "7")) {
      return NGO_HELP;
    }
    if (intent === "register") {
      await updateSession(session, { state: "reg_select_role" });
      return `Let's update your registration.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient`;
    }

    // Numeric menu
    if (intent === "numeric") {
      const n = t;
      if (n === "1") {
        await updateSession(session, { state: "reg_select_role" });
        return `Let's update your registration.\n\nAre you:\n1. Kitchen / Food Provider\n2. NGO / Recipient`;
      }
      // Delegate to NGO router for 2-7
      return handleNgoMessage(session, ngo, text, type);
    }

    // Image from NGO
    if (type === "image") {
      return "📷 Photo assessment is only available to registered kitchens. As an NGO/Recipient you can reply \"available food\" to see offers.";
    }

    // All other text: delegate to NGO router
    return handleNgoMessage(session, ngo, text, type);
  }

  return "Reply \"hi\" to get started with ResQFood AI.";
}

// ──────────────────────────────────────────────
// NLU: extract food name and quantity from text
// ──────────────────────────────────────────────

function extractFoodAndQuantity(text: string): { food_name?: string; quantity?: number; unit?: string } {
  const result: { food_name?: string; quantity?: number; unit?: string } = {};

  // Extract quantity: "25 portions", "10 kg", "30 plates"
  const qtyMatch = text.match(/(\d+)\s*(portions?|meals?|kg|servings?|plates?|packets?|boxes?)/i);
  if (qtyMatch) {
    result.quantity = Number(qtyMatch[1]);
    result.unit = /kg/i.test(qtyMatch[2]) ? "kg" : "portions";
  } else {
    // Just a number
    const numMatch = text.match(/\b(\d+)\b/);
    if (numMatch) {
      result.quantity = Number(numMatch[1]);
      result.unit = "portions";
    }
  }

  // Extract food name: remove quantity words, keep the rest
  let foodText = text
    .replace(/\b(we (have|got)|there (is|are)|i (have|want to report)|report|surplus|leftover|left over|remaining|extra|portions?|meals?|kg|servings?|plates?|packets?|boxes?|of|some|a|few|lot|lots)\b/gi, "")
    .replace(/\d+/g, "")
    .trim();

  // Clean up
  foodText = foodText.replace(/\s+/g, " ").replace(/^[-:,]+|[-:,]+$/g, "").trim();

  if (foodText && foodText.length >= 2) {
    result.food_name = foodText.charAt(0).toUpperCase() + foodText.slice(1);
  }

  return result;
}

// ──────────────────────────────────────────────
// Fetch conversation history
// ──────────────────────────────────────────────

export async function getConversationHistory(phone: string): Promise<ConversationMessage[]> {
  const supabase = await db();
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("direction, message_text, message_type, media_reference, created_at")
    .eq("from_phone", normalized)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.created_at + r.direction,
    who: r.direction === "inbound" ? "user" : "bot",
    text: r.message_text ?? "",
    imageUrl: r.message_type === "image" && r.media_reference ? r.media_reference : undefined,
    timestamp: r.created_at,
  }));
}

// ──────────────────────────────────────────────
// Fetch conversation session
// ──────────────────────────────────────────────

export async function getSession(phone: string): Promise<ConversationSessionRow | null> {
  const supabase = await db();
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("phone", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as ConversationSessionRow | null;
}
