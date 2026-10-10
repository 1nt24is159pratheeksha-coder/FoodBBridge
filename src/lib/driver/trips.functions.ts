import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Trip, TripStatus } from "@/lib/driver/trips";
import { tripStatusFromDatabase } from "@/lib/driver/trip-status";

const tripSelect = "id, quantity, created_at, delivery_status, surplus_id, surplus_food(food_name, quantity, unit, estimated_weight_kg, usable_until, pickup_location, kitchens(name, address, contact_name, phone)), ngos(name, address, contact_name, phone)";
const queryTimeout = () => AbortSignal.timeout(15_000);
type AllocationWithPartners = {
  id: string;
  quantity: number;
  delivery_status: string | null;
  surplus_food: null | {
    food_name: string;
    quantity: number;
    unit: string;
    estimated_weight_kg: number | null;
    usable_until: string | null;
    pickup_location: string | null;
    kitchens: null | { name: string; address: string | null; contact_name: string | null; phone: string };
  };
  ngos: null | { name: string; address: string | null; contact_name: string | null; phone: string };
};

async function driverForUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("drivers").select("id, name, phone, vehicle, status").eq("user_id", userId).abortSignal(queryTimeout()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.status !== "approved") throw new Error("This authenticated account is not an approved ResQFood driver.");
  return { db: supabaseAdmin, driver: data };
}

function toTrip(row: AllocationWithPartners, rejected = false, history: Trip["history"] = []): Trip {
  const surplus = row.surplus_food;
  const kitchen = surplus?.kitchens;
  const ngo = row.ngos;
  const status = tripStatusFromDatabase(row.delivery_status, rejected);
  return {
    id: row.id,
    food: surplus?.food_name ?? "Food allocation",
    quantity: `${row.quantity} ${surplus?.unit ?? "portions"}`,
    quantityValue: row.quantity,
    unit: surplus?.unit ?? "portions",
    ...(status === "Completed" && surplus?.estimated_weight_kg != null && surplus.quantity > 0
      ? { estimatedImpactKg: Number(surplus.estimated_weight_kg) * (row.quantity / surplus.quantity) }
      : {}),
    kitchen: kitchen?.name ?? "Partner kitchen",
    kitchenAddress: surplus?.pickup_location ?? kitchen?.address ?? "Address not provided",
    ...(status !== "Offered" && kitchen?.contact_name ? { kitchenContact: kitchen.contact_name } : {}),
    ...(status !== "Offered" && kitchen?.phone ? { kitchenPhone: kitchen.phone } : {}),
    ngo: ngo?.name ?? "Recipient",
    ngoAddress: ngo?.address ?? "Address not provided",
    ...(["Picked Up", "In Transit", "At Delivery"].includes(status) && ngo?.contact_name ? { ngoContact: ngo.contact_name } : {}),
    ...(["Picked Up", "In Transit", "At Delivery"].includes(status) && ngo?.phone ? { ngoPhone: ngo.phone } : {}),
    availableUntil: surplus?.usable_until ? new Date(surplus.usable_until).toLocaleString() : "Not specified",
    status,
    history,
  };
}

export const getDriverProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { driver } = await driverForUser(context.userId);
    return { name: driver.name, phone: driver.phone, vehicle: driver.vehicle };
  });

export const listDriverTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db, driver } = await driverForUser(context.userId);
    const [offersResult, assignedResult, rejectedResult] = await Promise.all([
      // Keep offer reads aligned with driver_accept_trip's exact eligibility guard.
      db.from("allocations").select(tripSelect).eq("status", "ACCEPTED").eq("delivery_status", "Awaiting driver assignment").is("driver_id", null).order("created_at", { ascending: false }).abortSignal(queryTimeout()),
      db.from("allocations").select(tripSelect).eq("driver_id", driver.id).order("created_at", { ascending: false }).abortSignal(queryTimeout()),
      db.from("driver_trip_responses").select("allocation_id").eq("driver_id", driver.id).eq("response", "Rejected").abortSignal(queryTimeout()),
    ]);
    if (offersResult.error) throw new Error(offersResult.error.message);
    if (assignedResult.error) throw new Error(assignedResult.error.message);
    if (rejectedResult.error) throw new Error(rejectedResult.error.message);
    const offerRows = offersResult.data ?? [];
    const rejectedIds = (rejectedResult.data ?? []).map((r) => r.allocation_id);
    const alreadyLoaded = new Set([...offerRows.map((r) => r.id), ...(assignedResult.data ?? []).map((r) => r.id)]);
    const extraRejectedIds = rejectedIds.filter((id) => !alreadyLoaded.has(id));
    const rejectedRows = extraRejectedIds.length
      ? await db.from("allocations").select(tripSelect).in("id", extraRejectedIds).abortSignal(queryTimeout())
      : { data: [], error: null };
    if (rejectedRows.error) throw new Error(rejectedRows.error.message);
    const rows = [...offerRows, ...(assignedResult.data ?? []), ...(rejectedRows.data ?? [])];
    const ids = rows.map((r) => r.id);
    const events = ids.length ? await db.from("driver_trip_events").select("allocation_id, status, created_at").in("allocation_id", ids).eq("driver_id", driver.id).order("created_at").abortSignal(queryTimeout()) : { data: [], error: null };
    if (events.error) throw new Error(events.error.message);
    return rows.map((row) => toTrip(row, rejectedIds.includes(row.id), (events.data ?? []).filter((e) => e.allocation_id === row.id).map((e) => ({ status: e.status as TripStatus, at: e.created_at }))));
  });

export const mutateDriverTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({
    id: z.string().uuid(),
    action: z.enum(["accept", "reject", "arrive_pickup", "verify_pickup", "start_transit", "arrive_delivery", "verify_delivery"]),
    otp: z.string().regex(/^\d{6}$/).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { db, driver } = await driverForUser(context.userId);
    let result;
    if (data.action === "accept") result = await db.rpc("driver_accept_trip", { p_allocation_id: data.id, p_driver_id: driver.id });
    else if (data.action === "reject") result = await db.rpc("driver_reject_trip", { p_allocation_id: data.id, p_driver_id: driver.id });
    else result = await db.rpc("driver_advance_trip", {
      p_allocation_id: data.id, p_driver_id: driver.id, p_action: data.action,
      p_otp: data.otp ?? null,
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true as const };
  });
