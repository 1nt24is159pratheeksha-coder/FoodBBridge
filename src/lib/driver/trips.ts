import { createLocalStore } from "@/lib/local-store";

/** Driver trip lifecycle (demo, browser storage). Pickup and delivery are both OTP-verified. */
export const tripSteps = ["Offered", "Accepted", "At Pickup", "Picked Up", "In Transit", "At Delivery", "Completed"] as const;
export type TripStatus = (typeof tripSteps)[number];

export type Trip = {
  id: string; food: string; quantity: string; kitchen: string; kitchenAddress: string; ngo: string; ngoAddress: string;
  pickupKm: number; deliveryKm: number; availableUntil: string; pickupOtp: string; deliveryOtp: string;
  status: TripStatus; history: { status: TripStatus; at: string }[];
};

export const DRIVER_PROFILE = { name: "Arjun Kumar", firstName: "Arjun", phone: "+91 98451 20987", vehicle: "Bike · KA-03-1122", zone: "Central Bengaluru" };

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const seed = (): Trip[] => [
  { id: "TRIP-501", food: "Vegetarian Rice", quantity: "50 portions", kitchen: "Fresh Bites Cafe", kitchenAddress: "100 Ft Rd, Indiranagar", ngo: "Feed The City", ngoAddress: "Shivajinagar",
    pickupKm: 2.1, deliveryKm: 4.3, availableUntil: "6:00 PM", pickupOtp: "4821", deliveryOtp: "7390", status: "Offered", history: [{ status: "Offered", at: ago(1) }] },
  { id: "TRIP-498", food: "Paneer Curry", quantity: "35 portions", kitchen: "Fresh Bites Cafe", kitchenAddress: "100 Ft Rd, Indiranagar", ngo: "Little Hearts Home", ngoAddress: "Jayanagar",
    pickupKm: 1.4, deliveryKm: 7.8, availableUntil: "3:00 PM", pickupOtp: "1194", deliveryOtp: "6603", status: "Completed",
    history: tripSteps.map((status, i) => ({ status, at: ago(300 - i * 8) })) },
];

export const tripStore = createLocalStore<Trip[]>("resqfood.driver-trips.v1", seed);
export const onlineStore = createLocalStore<boolean>("resqfood.driver-online.v1", () => true);
export const useTrips = tripStore.useStore;

const nextOf = (s: TripStatus) => tripSteps[tripSteps.indexOf(s) + 1];
function move(id: string, from: TripStatus) {
  tripStore.set((all) => all.map((t) => {
    const to = nextOf(t.status);
    return t.id === id && t.status === from && to ? { ...t, status: to, history: [...t.history, { status: to, at: new Date().toISOString() }] } : t;
  }));
}

export const acceptTrip = (id: string) => move(id, "Offered");
export const arriveAtPickup = (id: string) => move(id, "Accepted");
export const startTransit = (id: string) => move(id, "Picked Up");
export const arriveAtDelivery = (id: string) => move(id, "In Transit");

/** Returns false when the code is wrong; the trip only advances on a correct OTP. */
export function verifyTripOtp(id: string, kind: "pickup" | "delivery", otp: string) {
  const t = tripStore.get().find((x) => x.id === id);
  if (!t) return false;
  const expectedStatus: TripStatus = kind === "pickup" ? "At Pickup" : "At Delivery";
  const code = kind === "pickup" ? t.pickupOtp : t.deliveryOtp;
  if (t.status !== expectedStatus || otp.trim() !== code) return false;
  move(id, expectedStatus);
  return true;
}

export const isActiveTrip = (t: Trip) => t.status !== "Offered" && t.status !== "Completed";
