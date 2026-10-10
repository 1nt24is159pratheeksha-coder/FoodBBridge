import { useSyncExternalStore } from "react";

export const tripSteps = ["Offered", "Accepted", "At Pickup", "Picked Up", "In Transit", "At Delivery", "Completed"] as const;
export type TripStatus = (typeof tripSteps)[number] | "Rejected" | "Unavailable";

export type Trip = {
  id: string;
  food: string;
  quantity: string;
  quantityValue: number;
  unit: string;
  estimatedImpactKg?: number;
  kitchen: string;
  kitchenAddress: string;
  kitchenContact?: string;
  kitchenPhone?: string;
  ngo: string;
  ngoAddress: string;
  ngoContact?: string;
  ngoPhone?: string;
  availableUntil: string;
  status: TripStatus;
  history: { status: TripStatus; at: string }[];
};

type TripState = { trips: Trip[]; loading: boolean; error: string | null };

const demoTrips: Trip[] = [
  {
    id: "demo-trip-501",
    food: "Vegetable Rice",
    quantity: "40 portions",
    quantityValue: 40,
    unit: "portions",
    estimatedImpactKg: 12,
    kitchen: "Green Leaf Kitchen",
    kitchenAddress: "Demo pickup location, Bengaluru",
    ngo: "Hope Community Centre",
    ngoAddress: "Demo delivery location, Bengaluru",
    availableUntil: "Today",
    status: "Offered",
    history: [{ status: "Offered", at: new Date().toISOString() }],
  },
  {
    id: "demo-trip-502",
    food: "Chapati and Dal",
    quantity: "25 portions",
    quantityValue: 25,
    unit: "portions",
    estimatedImpactKg: 8,
    kitchen: "Annapoorna Kitchen",
    kitchenAddress: "Demo pickup location, Bengaluru",
    ngo: "Community Care NGO",
    ngoAddress: "Demo delivery location, Bengaluru",
    availableUntil: "Today",
    status: "Accepted",
    history: [{ status: "Accepted", at: new Date().toISOString() }],
  },
];

let state: TripState = { trips: demoTrips, loading: false, error: null };
const listeners = new Set<() => void>();

const publish = (next: TripState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTripState = () =>
  useSyncExternalStore(subscribe, () => state, () => state);

export const useTrips = () => useTripState().trips;

export async function refreshTrips() {
  publish({ ...state, loading: false, error: null });
}

export type TripAction =
  | "accept"
  | "reject"
  | "arrive_pickup"
  | "verify_pickup"
  | "start_transit"
  | "arrive_delivery"
  | "verify_delivery";

const statusForAction: Record<TripAction, TripStatus> = {
  accept: "Accepted",
  reject: "Rejected",
  arrive_pickup: "At Pickup",
  verify_pickup: "Picked Up",
  start_transit: "In Transit",
  arrive_delivery: "At Delivery",
  verify_delivery: "Completed",
};

export async function performTripAction(
  id: string,
  action: TripAction,
  otp?: string,
) {
  if (
    (action === "verify_pickup" || action === "verify_delivery") &&
    !/^\d{6}$/.test(otp ?? "")
  ) {
    throw new Error("Enter a valid 6-digit demo OTP.");
  }

  const trip = state.trips.find((item) => item.id === id);
  if (!trip) throw new Error("Demo trip not found.");

  const status = statusForAction[action];
  const updatedTrip: Trip = {
    ...trip,
    status,
    history: [
      ...trip.history,
      { status, at: new Date().toISOString() },
    ],
  };

  publish({
    ...state,
    trips: state.trips.map((item) => item.id === id ? updatedTrip : item),
    error: null,
  });
}

export const acceptTrip = (id: string) => performTripAction(id, "accept");
export const rejectTrip = (id: string) => performTripAction(id, "reject");
export const arriveAtPickup = (id: string) => performTripAction(id, "arrive_pickup");
export const startTransit = (id: string) => performTripAction(id, "start_transit");
export const arriveAtDelivery = (id: string) => performTripAction(id, "arrive_delivery");

export const verifyTripOtp = (
  id: string,
  kind: "pickup" | "delivery",
  otp: string,
) =>
  performTripAction(
    id,
    kind === "pickup" ? "verify_pickup" : "verify_delivery",
    otp,
  );

export const isActiveTrip = (trip: Trip) =>
  trip.status !== "Offered" &&
  trip.status !== "Completed" &&
  trip.status !== "Rejected" &&
  trip.status !== "Unavailable";
