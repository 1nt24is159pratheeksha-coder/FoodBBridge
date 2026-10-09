/**
 * NGO / Recipient branch of the shared WhatsApp assistant (server only).
 * Called from pipeline.server.ts after the sender phone resolves to a registered NGO.
 * Session state lives on the ngos row (conversation_state, pending_surplus_id, proposed_quantity).
 */
type Db = Awaited<ReturnType<typeof getDb>>;
async function getDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type NgoRow = {
  id: string; name: string; status: string; distance_km: number | string | null;
  conversation_state: string; pending_surplus_id: string | null; proposed_quantity: number | null;
};

type Offer = { id: string; food_name: string; unit: string; available: number; usable_until: string | null; pickup_location: string | null; kitchen: string; state: string };
import { isAvailableOffer, remainingOfferQuantity } from "./ngo-availability";

export const NGO_MENU =
  "👋 Welcome to ResQFood AI. You are registered as an NGO/Recipient. How can I help?\n\n1 - Available Food\n2 - My Allocations\n3 - Delivery Status\n4 - Help";

const HELP =
  "ℹ️ You can ask me things like:\n• \"show available food\"\n• \"we can take 20\" / \"accept\" / \"reject\"\n• \"how much time is left?\" / \"where is the food?\"\n• \"my allocations\"\n• \"where is my food?\"\n\nReply \"menu\" anytime to see the options.";

function hoursLeft(until: string | null) {
  return until ? (new Date(until).getTime() - Date.now()) / 3_600_000 : null;
}
function priority(until: string | null) {
  const h = hoursLeft(until);
  if (h == null) return "NORMAL";
  if (h <= 0) return "EXPIRED";
  if (h < 1) return "URGENT";
  if (h <= 2) return "HIGH";
  return "NORMAL";
}
function timeLeft(until: string | null) {
  const h = hoursLeft(until);
  if (h == null) return "not specified";
  if (h <= 0) return "expired";
  const mins = Math.round(h * 60);
  return mins < 60 ? `${mins} minutes` : `${Math.floor(mins / 60)} h ${mins % 60 ? `${mins % 60} min` : ""}`.trim();
}
function unitLabel(u: string) {
  return u === "portions" ? "meals" : u;
}

async function availableOffers(db: Db): Promise<Offer[]> {
  const { data: rows, error } = await db
    .from("surplus_food")
    .select("id, food_name, quantity, unit, usable_until, pickup_location, state, kitchens(name, address)")
    .in("state", ["ASSESSMENT_COMPLETE", "AVAILABLE"])
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => r.id);
  const { data: allocs } = ids.length
    ? await db.from("allocations").select("surplus_id, quantity").eq("status", "ACCEPTED").in("surplus_id", ids)
    : { data: [] };
  const used = new Map<string, number>();
  for (const a of allocs ?? []) used.set(a.surplus_id, (used.get(a.surplus_id) ?? 0) + a.quantity);
  return (rows ?? [])
    .map((r) => {
      const k = r.kitchens as { name: string; address: string | null } | null;
      return {
        id: r.id, food_name: r.food_name, unit: r.unit, usable_until: r.usable_until,
        available: remainingOfferQuantity(r.quantity, used.get(r.id) ?? 0),
        pickup_location: r.pickup_location ?? k?.address ?? null, kitchen: k?.name ?? "Partner kitchen", state: r.state,
      };
    })
    .filter((o) => isAvailableOffer(o.state, o.available, o.usable_until));
}

function offerText(o: Offer, ngo: NgoRow) {
  const dist = ngo.distance_km != null ? `${Number(ngo.distance_km)} km (approx.)` : "not available";
  return [
    "🍱 New Food Available", "",
    `Food: ${o.food_name}`,
    `Available: ${o.available} ${unitLabel(o.unit)}`,
    `Usable time: ${timeLeft(o.usable_until)}`,
    `Distance: ${dist}`,
    `Priority: ${priority(o.usable_until)}`,
    `Kitchen: ${o.kitchen}`, "",
    "Can your organization accept this?",
    "1 - Accept",
    "2 - Reject", "",
    "You can also say e.g. \"we can take 20\".",
  ].join("\n");
}

const num = (t: string) => {
  const m = t.match(/\d+/);
  return m ? Number(m[0]) : null;
};
const is = (t: string, re: RegExp) => re.test(t);

const GREET = /^(hi+|hello|hey|start|menu|namaste|good (morning|afternoon|evening))\b/;
const REJECT = /\b(no|nope|reject|decline|cannot|can't|cant|not able|unable|pass)\b/;
const ACCEPT = /\b(yes|yeah|yep|accept|take|ok|okay|sure|need|give us|want|we can)\b/;
const CONFIRM = /\b(confirm|yes|correct|right|ok|okay|sure|go ahead|done)\b/;
const EDIT = /\b(edit|change|actually|instead|modify|update|make it)\b/;
const DELIVERY = /(deliver|arriv|where is my|where's my|track|eta|driver|status)/;
const ALLOC = /(allocation|my food list|my requests|accepted food|what have we)/;
const AVAIL = /(available|what food|any food|show food|how many meals|offers?|surplus)/;
const TIME = /(time (is )?left|how long|expire|usable|until when)/;
const WHERE = /(where is the food|where's the food|pickup|location|address|where.*kitchen)/;

async function setState(db: Db, ngo: NgoRow, patch: Partial<Pick<NgoRow, "conversation_state" | "pending_surplus_id" | "proposed_quantity">>) {
  const { error } = await db.from("ngos").update(patch).eq("id", ngo.id);
  if (error) throw new Error(error.message);
  Object.assign(ngo, patch);
}

async function pendingOffer(db: Db, ngo: NgoRow) {
  if (!ngo.pending_surplus_id) return null;
  return (await availableOffers(db)).find((o) => o.id === ngo.pending_surplus_id) ?? null;
}

async function showAvailable(db: Db, ngo: NgoRow) {
  const offers = await availableOffers(db);
  if (!offers.length) {
    await setState(db, ngo, { conversation_state: "idle", pending_surplus_id: null, proposed_quantity: null });
    return "There is no available surplus food at the moment. We'll message you when a kitchen registers new food.";
  }
  const total = offers.reduce((s, o) => s + o.available, 0);
  const first = offers[0]!;
  await setState(db, ngo, { conversation_state: "offer", pending_surplus_id: first.id, proposed_quantity: null });
  const others = offers.slice(1, 4).map((o) => `• ${o.food_name} — ${o.available} ${unitLabel(o.unit)}, ${timeLeft(o.usable_until)} left (${priority(o.usable_until)})`);
  return [
    `${offers.length} item(s) available, ${total} units in total.`, "",
    offerText(first, ngo),
    ...(others.length ? ["", "Also available:", ...others] : []),
  ].join("\n");
}

async function myAllocations(db: Db, ngo: NgoRow) {
  const { data, error } = await db.from("allocations").select("quantity, status, delivery_status, created_at, surplus_food(food_name, unit)")
    .eq("ngo_id", ngo.id).order("created_at", { ascending: false }).limit(5);
  if (error) throw new Error(error.message);
  if (!data?.length) return "You don't have any allocations yet. Reply \"available food\" to see what's on offer.";
  return ["📋 Your recent allocations:", ...data.map((a) => {
    const s = a.surplus_food as { food_name: string; unit: string } | null;
    return a.status === "ACCEPTED"
      ? `• ${a.quantity} ${unitLabel(s?.unit ?? "meals")} of ${s?.food_name} — Accepted · Delivery: ${a.delivery_status ?? "Awaiting driver assignment"}`
      : `• ${s?.food_name} — Declined`;
  })].join("\n");
}

async function deliveryStatus(db: Db, ngo: NgoRow) {
  const { data } = await db.from("allocations").select("quantity, delivery_status, surplus_food(food_name, unit, kitchens(name))")
    .eq("ngo_id", ngo.id).eq("status", "ACCEPTED").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return "You don't have an accepted allocation yet, so there is no delivery to track.";
  const s = data.surplus_food as { food_name: string; unit: string; kitchens: { name: string } | null } | null;
  const st = data.delivery_status ?? "Awaiting driver assignment";
  const eta = st === "Delivered" ? "It has been delivered." : st === "In Transit" ? "The driver is on the way." : "No driver has been assigned yet, so an arrival time isn't available. We'll update you once a driver accepts.";
  return `🚚 Delivery status for ${data.quantity} ${unitLabel(s?.unit ?? "meals")} of ${s?.food_name} from ${s?.kitchens?.name ?? "the kitchen"}:\nStatus: ${st}\n${eta}\n\nLifecycle: Assigned → Accepted → Picked Up → In Transit → Delivered`;
}

async function propose(db: Db, ngo: NgoRow, offer: Offer, qty: number) {
  if (qty <= 0) return "Please tell me a quantity greater than 0.";
  if (qty > offer.available) return `Only ${offer.available} ${unitLabel(offer.unit)} are available. How many would you like to accept?`;
  await setState(db, ngo, { conversation_state: "confirm", proposed_quantity: qty });
  const u = unitLabel(offer.unit);
  return `Got it. You want to accept ${qty} of the ${offer.available} available ${u} of ${offer.food_name}.\n\nPlease confirm:\n1 - Confirm\n2 - Edit`;
}

export async function routeNgo(ngo: NgoRow, type: string, rawText: string): Promise<string> {
  const db = await getDb();
  if (ngo.status !== "approved") return "Your NGO registration is still pending approval. We'll message you once it's approved.";
  if (type === "image") return "📷 Photo assessment is only available to registered kitchens. As an NGO/Recipient you can reply \"available food\" to see offers.";
  if (type === "voice") return "🎙️ Voice notes are not supported yet. Please type your message.";
  if (type !== "text") return "Sorry, this message type is not supported. Reply \"menu\" to see options.";

  const t = rawText.trim().toLowerCase();
  const state = ngo.conversation_state;

  // Global intents (work in any state)
  if (is(t, GREET)) {
    await setState(db, ngo, { conversation_state: "idle", pending_surplus_id: null, proposed_quantity: null });
    return NGO_MENU;
  }
  if (t === "help" || (state === "idle" && t === "4")) return HELP;
  if (is(t, /(photo|report surplus|register surplus|add surplus)/)) return "Reporting surplus and photo assessment are only available to kitchens. Reply \"available food\" to see offers.";
  if (is(t, DELIVERY) || (state === "idle" && t === "3")) return deliveryStatus(db, ngo);
  if (is(t, ALLOC) || (state === "idle" && t === "2")) return myAllocations(db, ngo);

  const offer = await pendingOffer(db, ngo);
  if (is(t, TIME) || is(t, WHERE)) {
    const o = offer ?? (await availableOffers(db))[0];
    if (!o) return "There is no available food right now.";
    return is(t, TIME)
      ? `⏱️ ${o.food_name} is usable for about ${timeLeft(o.usable_until)} more (priority ${priority(o.usable_until)}).`
      : `📍 ${o.food_name} is at ${o.kitchen}${o.pickup_location ? `, ${o.pickup_location}` : ""}.`;
  }
  if (is(t, AVAIL) || (state === "idle" && t === "1")) return showAvailable(db, ngo);

  if (state !== "idle" && !offer) {
    await setState(db, ngo, { conversation_state: "idle", pending_surplus_id: null, proposed_quantity: null });
    return "That food offer is no longer available. Reply \"available food\" to see current offers.";
  }

  if (state === "offer" && offer) {
    const n = num(t);
    if (t === "2" || (is(t, REJECT) && n == null)) return decline(db, ngo, offer);
    if (n != null && t !== "1") return propose(db, ngo, offer, n);
    if (t === "1" || is(t, ACCEPT)) return propose(db, ngo, offer, offer.available);
    return "Would your organization like to accept this food? Reply 1 (Accept), 2 (Reject), or tell me a quantity, e.g. \"we can take 20\".";
  }

  if ((state === "confirm" || state === "awaiting_quantity") && offer) {
    const n = num(t);
    if (state === "awaiting_quantity" || (n != null && t !== "1" && t !== "2")) {
      if (n == null) return "Please tell me the quantity as a number, e.g. 15.";
      return propose(db, ngo, offer, n);
    }
    if (t === "2" || is(t, EDIT)) {
      await setState(db, ngo, { conversation_state: "awaiting_quantity" });
      return `How many ${unitLabel(offer.unit)} would you like? (up to ${offer.available})`;
    }
    if (is(t, REJECT) && !is(t, CONFIRM)) return decline(db, ngo, offer);
    if (t === "1" || is(t, CONFIRM)) return confirm(db, ngo, offer);
    return "Please reply 1 to Confirm or 2 to Edit the quantity.";
  }

  return `Sorry, I didn't understand that.\n\n${NGO_MENU}`;
}

async function confirm(db: Db, ngo: NgoRow, offer: Offer) {
  const qty = ngo.proposed_quantity ?? offer.available;
  if (qty > offer.available) {
    await setState(db, ngo, { conversation_state: "awaiting_quantity" });
    return `Only ${offer.available} ${unitLabel(offer.unit)} are still available. How many would you like?`;
  }
  const { error } = await db.from("allocations").insert({
    surplus_id: offer.id, ngo_id: ngo.id, quantity: qty, status: "ACCEPTED", delivery_status: "Awaiting driver assignment",
  });
  if (error) throw new Error(error.message);
  if (qty >= offer.available) await db.from("surplus_food").update({ state: "ALLOCATED" }).eq("id", offer.id);
  await setState(db, ngo, { conversation_state: "idle", pending_surplus_id: null, proposed_quantity: null });
  return `✅ Allocation confirmed. ${qty} ${unitLabel(offer.unit)} of ${offer.food_name} have been allocated to your organization.\n\nAsk "where is my food?" anytime for delivery status.`;
}

async function decline(db: Db, ngo: NgoRow, offer: Offer) {
  const { error } = await db.from("allocations").insert({ surplus_id: offer.id, ngo_id: ngo.id, quantity: 0, status: "REJECTED" });
  if (error) throw new Error(error.message);
  await setState(db, ngo, { conversation_state: "idle", pending_surplus_id: null, proposed_quantity: null });
  return "Understood. The allocation has been declined. The food stays available for other recipients.";
}
