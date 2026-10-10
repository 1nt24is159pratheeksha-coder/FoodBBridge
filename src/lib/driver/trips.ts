import { useSyncExternalStore } from "react";
import { listDriverTrips, mutateDriverTrip } from "@/lib/driver/trips.functions";

export const tripSteps = ["Offered", "Accepted", "At Pickup", "Picked Up", "In Transit", "At Delivery", "Completed"] as const;
export type TripStatus = (typeof tripSteps)[number] | "Rejected" | "Unavailable";
export type Trip = {
  id: string; food: string; quantity: string; quantityValue: number; unit: string; estimatedImpactKg?: number; kitchen: string; kitchenAddress: string; kitchenContact?: string; kitchenPhone?: string;
  ngo: string; ngoAddress: string; ngoContact?: string; ngoPhone?: string;
  availableUntil: string; status: TripStatus; history: { status: TripStatus; at: string }[];
};

type TripState = { trips: Trip[]; loading: boolean; error: string | null };
let state: TripState = { trips: [], loading: false, error: null };
const listeners = new Set<() => void>();
let pending: Promise<void> | null = null;
const publish = (next: TripState) => { state = next; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!pending && !state.trips.length) void refreshTrips();
  return () => { listeners.delete(listener); };
};
export const useTripState = () => useSyncExternalStore(subscribe, () => state, () => state);
export const useTrips = () => useTripState().trips;

export async function refreshTrips() {
  if (pending) return pending;
  const request = Promise.resolve().then(async () => {
    publish({ ...state, loading: true, error: null });
    try {
      const trips = await listDriverTrips();
      publish({ trips, loading: false, error: null });
    } catch (error) {
      publish({ ...state, loading: false, error: error instanceof Error ? error.message : "Unable to load trips." });
    } finally { pending = null; }
  });
  pending = request;
  return pending;
}

export type TripAction = "accept" | "reject" | "arrive_pickup" | "verify_pickup" | "start_transit" | "arrive_delivery" | "verify_delivery";
export async function performTripAction(id: string, action: TripAction, otp?: string) {
  await mutateDriverTrip({ data: { id, action, ...(otp ? { otp } : {}) } });
  await refreshTrips();
}
export const acceptTrip = (id: string) => performTripAction(id, "accept");
export const rejectTrip = (id: string) => performTripAction(id, "reject");
export const arriveAtPickup = (id: string) => performTripAction(id, "arrive_pickup");
export const startTransit = (id: string) => performTripAction(id, "start_transit");
export const arriveAtDelivery = (id: string) => performTripAction(id, "arrive_delivery");
export const verifyTripOtp = (id: string, kind: "pickup" | "delivery", otp: string) => performTripAction(id, kind === "pickup" ? "verify_pickup" : "verify_delivery", otp);

export const isActiveTrip = (trip: Trip) => trip.status !== "Offered" && trip.status !== "Completed" && trip.status !== "Rejected" && trip.status !== "Unavailable";
