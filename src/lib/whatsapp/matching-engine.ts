/**
 * NGO matching / ranking engine.
 * Scores verified NGOs against a surplus food item using:
 *   - distance (geolocation or distance_km column)
 *   - food type compatibility (food_requirements vs food_name)
 *   - capacity fit (capacity_meals vs surplus quantity)
 *   - urgency (usable_until window)
 *   - verification status
 *
 * Weights are transparent and modular — can be replaced by an ML model later.
 * This is a scoring algorithm, NOT machine learning.
 */

interface SurplusRow {
  id: string; food_name: string; quantity: number; unit: string;
  estimated_weight_kg: number | null; usable_until: string | null; urgency: string | null;
  kitchen_id: string; kitchens?: { id: string; name: string; city: string | null; latitude: number | null; longitude: number | null } | null;
}

interface NgoRow {
  id: string; name: string; status: string; distance_km: number | null;
  city: string | null; latitude: number | null; longitude: number | null;
  capacity_meals: number | null; food_requirements: string | null;
}

export interface MatchResult {
  ngo_id: string;
  ngo_name: string;
  total_score: number;
  rank: number;
  distance_km: number | null;
  distance_score: number;
  compatibility_score: number;
  capacity_score: number;
  urgency_score: number;
  verification_score: number;
}

// Weights (sum = 1.0)
const WEIGHTS = {
  distance: 0.30,
  compatibility: 0.25,
  capacity: 0.15,
  urgency: 0.15,
  verification: 0.15,
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function rankNgosForSurplus(surplusId: string): Promise<MatchResult[]> {
  const supabase = await db();

  // Fetch the surplus item with kitchen info
  const { data: surplus, error: sErr } = await supabase
    .from("surplus_food")
    .select("id, food_name, quantity, unit, estimated_weight_kg, usable_until, urgency, kitchen_id, kitchens(name, city, latitude, longitude)")
    .eq("id", surplusId)
    .maybeSingle();
  if (sErr || !surplus) return [];

  const s = surplus as unknown as SurplusRow;

  // Fetch verified NGOs
  const { data: ngos, error: nErr } = await supabase
    .from("ngos")
    .select("id, name, status, distance_km, city, latitude, longitude, capacity_meals, food_requirements")
    .eq("status", "approved");
  if (nErr || !ngos?.length) return [];

  // Check existing active allocations for each NGO (don't match if they already have pending food)
  const { data: activeAllocs } = await supabase
    .from("allocations")
    .select("ngo_id, quantity")
    .eq("status", "ACCEPTED")
    .in("ngo_id", ngos.map((n) => n.id));

  const activeByNgo = new Map<string, number>();
  for (const a of activeAllocs ?? []) {
    activeByNgo.set(a.ngo_id, (activeByNgo.get(a.ngo_id) ?? 0) + a.quantity);
  }

  // Score each NGO
  const results: Omit<MatchResult, "rank">[] = ngos.map((ngo) => {
    const n = ngo as unknown as NgoRow;
    return {
      ngo_id: n.id,
      ngo_name: n.name,
      total_score: 0,
      distance_km: n.distance_km,
      distance_score: scoreDistance(s, n),
      compatibility_score: scoreCompatibility(s, n),
      capacity_score: scoreCapacity(s, n, activeByNgo.get(n.id) ?? 0),
      urgency_score: scoreUrgency(s),
      verification_score: scoreVerification(n),
    };
  });

  // Compute weighted total
  for (const r of results) {
    r.total_score =
      r.distance_score * WEIGHTS.distance +
      r.compatibility_score * WEIGHTS.compatibility +
      r.capacity_score * WEIGHTS.capacity +
      r.urgency_score * WEIGHTS.urgency +
      r.verification_score * WEIGHTS.verification;
    r.total_score = Math.round(r.total_score * 100);
  }

  // Sort by score descending
  results.sort((a, b) => b.total_score - a.total_score);

  // Assign ranks
  const ranked: MatchResult[] = results.map((r, i) => ({ ...r, rank: i + 1 }));

  // Persist matches to ngo_matches table
  if (ranked.length > 0) {
    const rows = ranked.map((r) => ({
      surplus_id: surplusId,
      ngo_id: r.ngo_id,
      distance_score: r.distance_score,
      compatibility_score: r.compatibility_score,
      capacity_score: r.capacity_score,
      urgency_score: r.urgency_score,
      verification_score: r.verification_score,
      total_score: r.total_score / 100,
      rank: r.rank,
    }));
    // Delete old matches for this surplus, then insert
    await supabase.from("ngo_matches").delete().eq("surplus_id", surplusId);
    await supabase.from("ngo_matches").insert(rows);
  }

  return ranked;
}

// ── Scoring functions (each returns 0-1) ──

function scoreDistance(surplus: SurplusRow, ngo: NgoRow): number {
  // If both have lat/lng, compute haversine
  if (surplus.kitchens?.latitude && surplus.kitchens?.longitude && ngo.latitude && ngo.longitude) {
    const km = haversine(
      surplus.kitchens.latitude, surplus.kitchens.longitude,
      ngo.latitude, ngo.longitude,
    );
    return distanceToScore(km);
  }
  // Fall back to distance_km column
  if (ngo.distance_km != null) return distanceToScore(Number(ngo.distance_km));
  // No distance info — neutral score
  return 0.5;
}

function distanceToScore(km: number): number {
  if (km <= 0) return 1;
  if (km <= 2) return 0.9;
  if (km <= 5) return 0.7;
  if (km <= 10) return 0.5;
  if (km <= 20) return 0.3;
  if (km <= 50) return 0.1;
  return 0.05;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function scoreCompatibility(surplus: SurplusRow, ngo: NgoRow): number {
  if (!ngo.food_requirements) return 0.7; // No preferences = compatible with anything
  const reqs = ngo.food_requirements.toLowerCase();
  const food = surplus.food_name.toLowerCase();

  // "Any" or empty = accepts everything
  if (reqs.includes("any")) return 1;

  // Vegetarian check
  if (reqs.includes("vegetarian") || reqs.includes("veg")) {
    const nonVeg = ["chicken", "mutton", "beef", "pork", "fish", "meat", "egg", "prawn"];
    if (nonVeg.some((nv) => food.includes(nv))) return 0.1;
  }

  // No pork
  if (reqs.includes("no pork") && food.includes("pork")) return 0.1;

  // Check if food name matches any requirement keyword
  const reqKeywords = reqs.split(/[,/]/).map((r) => r.trim()).filter(Boolean);
  for (const kw of reqKeywords) {
    if (food.includes(kw) || kw.includes(food)) return 1;
  }

  return 0.5; // No direct match but no conflict
}

function scoreCapacity(surplus: SurplusRow, ngo: NgoRow, activeLoad: number): number {
  if (!ngo.capacity_meals || ngo.capacity_meals <= 0) return 0.5;
  const available = ngo.capacity_meals - activeLoad;
  if (available <= 0) return 0.05; // Full capacity
  // Score based on how well the surplus fits available capacity
  const ratio = surplus.quantity / available;
  if (ratio <= 0.3) return 0.9; // NGO can easily handle this
  if (ratio <= 0.6) return 0.7;
  if (ratio <= 0.9) return 0.5;
  if (ratio <= 1.0) return 0.3;
  return 0.1; // Surplus exceeds capacity
}

function scoreUrgency(surplus: SurplusRow): number {
  // Urgent surplus should match faster — higher score means better fit
  if (surplus.urgency === "URGENT") return 1;
  if (surplus.urgency === "HIGH") return 0.8;
  if (surplus.usable_until) {
    const hoursLeft = (new Date(surplus.usable_until).getTime() - Date.now()) / 3_600_000;
    if (hoursLeft <= 1) return 1;
    if (hoursLeft <= 2) return 0.8;
    if (hoursLeft <= 4) return 0.6;
    return 0.4;
  }
  return 0.5;
}

function scoreVerification(ngo: NgoRow): number {
  if (ngo.status === "approved") return 1;
  if (ngo.status === "pending") return 0.3;
  return 0; // rejected
}
