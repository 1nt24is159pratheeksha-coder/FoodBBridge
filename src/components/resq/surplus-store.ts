import { useEffect, useState } from "react";
import type { Status } from "./dashboard-content";
import { getPriority, initialSurplus, type Priority, type SurplusItem } from "./surplus";

/** Shared demo surplus record, persisted in browser localStorage (prototype only). */
export type SurplusRecord = {
  id: string; foodName: string; quantity: number; unit: string; estimatedWeight: number;
  preparedAt: string; usableUntil: string; category: string; storageCondition: string;
  pickupLocation: string; image?: string | undefined; notes: string;
  qualityStatus: SurplusItem["quality"]; rescuePriority: Priority; currentStatus: Status;
  kitchenName: string; createdAt: string; assessment?: Assessment | undefined;
};
export type ScreeningStatus = "ELIGIBLE FOR REVIEW" | "REVIEW REQUIRED" | "URGENT" | "EXPIRED" | "REJECTED";
/** Simulated AI assessment saved on a surplus record (replace with a real vision model later). */
export type Assessment = {
  foodDetected: string; estimatedPortions: number; estimatedWeight: number; screening: ScreeningStatus;
  qualityNotes: string[]; quantityConfidence: number; visualConfidence: number; assessedAt: string; simulated: true;
};
export type RequestStatus = "Pending" | "Accepted" | "Rejected" | "Accepted / Delivered";
export type DeliveryStatus = "Driver Assignment Pending" | "Driver Assigned" | "Ready for Pickup" | "Picked Up" | "In Transit" | "Arrived at Destination" | "Delivered";
export type Delivery = {
  id: string; surplusId: string; foodName: string; quantity: number; unit: string; kitchenName: string; pickupLocation: string;
  ngoName: string; deliveryLocation: string; assignedDriver: string | null; status: DeliveryStatus;
  createdAt: string; pickupTime: string | null; deliveryTime: string | null; otp: string; deliveredQuantity?: number;
};
export type NotifRole = "kitchen" | "ngo" | "driver";
export type NgoRequest = { id: string; surplusId: string; ngoId?: string; ngoName: string; requestedQuantity?: number; status: RequestStatus; createdAt: string };
export type KitchenNotification = { id: string; message: string; kind: "accepted" | "rejected" | "delivery"; createdAt: string; read: boolean; role?: NotifRole };

const SURPLUS_KEY = "resqfood.surplus.v1";
const REQUESTS_KEY = "resqfood.requests.v1";
const NOTIFS_KEY = "resqfood.notifications.v1";
const DELIVERIES_KEY = "resqfood.deliveries.v1";
export const DRIVER = "Ravi Kumar";
const NGO_ADDRESS = "Sunrise Shelter, 45 Lake View Street, Domlur";
const EVENT = "resqfood-store";
const KITCHEN = "Harvest Community Kitchen";

export const toRecord = (i: SurplusItem): SurplusRecord => ({
  id: i.id, foodName: i.name, quantity: i.quantity, unit: i.unit, estimatedWeight: i.weightKg,
  preparedAt: i.preparedAt, usableUntil: i.usableUntil, category: i.category, storageCondition: i.storage,
  pickupLocation: i.location, image: i.imageUrl, notes: i.notes, qualityStatus: i.quality,
  rescuePriority: getPriority(i.usableUntil), currentStatus: i.status, kitchenName: KITCHEN, createdAt: new Date().toISOString(),
});
export const toItem = (r: SurplusRecord): SurplusItem => ({
  id: r.id, name: r.foodName, quantity: r.quantity, unit: r.unit, weightKg: r.estimatedWeight,
  preparedAt: r.preparedAt, usableUntil: r.usableUntil, category: r.category, storage: r.storageCondition,
  location: r.pickupLocation, notes: r.notes, imageUrl: r.image, quality: r.qualityStatus, status: r.currentStatus,
});

function read<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  const value = fallback();
  write(key, value, false);
  return value;
}
function write(key: string, value: unknown, notify = true) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {
    // Quota exceeded (large photo): retry without images.
    if (Array.isArray(value)) localStorage.setItem(key, JSON.stringify(value.map((v) => ({ ...v, image: undefined }))));
  }
  if (notify) window.dispatchEvent(new Event(EVENT));
}

const loadSurplus = () => read<SurplusRecord[]>(SURPLUS_KEY, () => initialSurplus().map(toRecord));
const loadRequests = () => read<NgoRequest[]>(REQUESTS_KEY, () => []);

export function addSurplus(record: SurplusRecord) { write(SURPLUS_KEY, [record, ...loadSurplus()]); }
export const loadNotifications = () => read<KitchenNotification[]>(NOTIFS_KEY, () => []);
export const NGO = { id: "ngo-sunrise", name: "Sunrise Shelter" };

/** NGO accepts or rejects a surplus offer; updates request, surplus status and kitchen notifications. */
export function respondToOffer(surplusId: string, decision: "Accepted" | "Rejected") {
  const surplus = loadSurplus();
  const rec = surplus.find((r) => r.id === surplusId);
  if (!rec) return;
  const now = new Date().toISOString();
  const others = loadRequests().filter((r) => !(r.surplusId === surplusId && r.ngoId === NGO.id));
  write(REQUESTS_KEY, [{ id: crypto.randomUUID(), surplusId, ngoId: NGO.id, ngoName: NGO.name, requestedQuantity: rec.quantity, status: decision, createdAt: now }, ...others]);
  write(SURPLUS_KEY, surplus.map((r) => r.id === surplusId ? { ...r, currentStatus: decision === "Accepted" ? "NGO Accepted" : "Available for next recipient" } : r));
  const message = decision === "Accepted"
    ? `${NGO.name} accepted ${rec.quantity} ${rec.unit.toLowerCase()} of ${rec.foodName}.`
    : `${NGO.name} rejected the ${rec.foodName} offer.`;
  notify("kitchen", message, decision === "Accepted" ? "accepted" : "rejected");
  if (decision === "Accepted" && !loadDeliveries().some((d) => d.surplusId === surplusId && d.status !== "Delivered")) write(DELIVERIES_KEY, [makeDelivery(rec), ...loadDeliveries()]);
}
function notify(role: NotifRole, message: string, kind: KitchenNotification["kind"] = "delivery") {
  write(NOTIFS_KEY, [{ id: crypto.randomUUID(), message, kind, role, createdAt: new Date().toISOString(), read: false }, ...loadNotifications()]);
}
function makeDelivery(rec: SurplusRecord, createdAt = new Date().toISOString()): Delivery {
  return { id: crypto.randomUUID(), surplusId: rec.id, foodName: rec.foodName, quantity: rec.quantity, unit: rec.unit, kitchenName: rec.kitchenName,
    pickupLocation: rec.pickupLocation, ngoName: NGO.name, deliveryLocation: NGO_ADDRESS, assignedDriver: null, status: "Driver Assignment Pending",
    createdAt, pickupTime: null, deliveryTime: null, otp: String(Math.floor(100000 + Math.random() * 900000)) };
}
/** Backfills deliveries for requests accepted before deliveries existed. */
const loadDeliveries = () => read<Delivery[]>(DELIVERIES_KEY, () => {
  const surplus = loadSurplus();
  return loadRequests().filter((r) => r.status === "Accepted").flatMap((r) => { const s = surplus.find((x) => x.id === r.surplusId); return s ? [makeDelivery(s, r.createdAt)] : []; });
});
const nextStatus: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  "Driver Assignment Pending": "Driver Assigned", "Driver Assigned": "Ready for Pickup", "Ready for Pickup": "Picked Up", "Picked Up": "In Transit", "In Transit": "Arrived at Destination",
};
export function advanceDelivery(id: string) {
  const d = loadDeliveries().find((x) => x.id === id);
  const next = d && nextStatus[d.status];
  if (!d || !next) return;
  const now = new Date().toISOString();
  write(DELIVERIES_KEY, loadDeliveries().map((x) => x.id === id ? { ...x, status: next, assignedDriver: x.assignedDriver ?? DRIVER, pickupTime: next === "Picked Up" ? now : x.pickupTime } : x));
  const qty = `${d.quantity} ${d.unit.toLowerCase()}`;
  if (next === "Driver Assigned") { notify("kitchen", `Driver ${DRIVER} was assigned to pick up ${qty} of ${d.foodName}.`); notify("ngo", `Driver ${DRIVER} is assigned to your ${d.foodName} delivery.`); }
  if (next === "Picked Up") { notify("kitchen", `${qty} have been picked up by the driver.`); notify("ngo", `Your ${d.foodName} has been picked up.`); }
  if (next === "In Transit") { notify("kitchen", `${qty} of ${d.foodName} are in transit to ${d.ngoName}.`); notify("ngo", "Your food delivery is now in transit."); }
  if (next === "Arrived at Destination") notify("ngo", `The driver has arrived with your ${d.foodName}. Share your delivery code.`);
}
/** Returns true when the OTP matches and the delivery is completed. */
export function verifyDeliveryOtp(id: string, otp: string): boolean {
  const d = loadDeliveries().find((x) => x.id === id);
  if (!d || d.otp !== otp.trim()) return false;
  const now = new Date().toISOString();
  write(DELIVERIES_KEY, loadDeliveries().map((x) => x.id === id ? { ...x, status: "Delivered", deliveryTime: now, deliveredQuantity: x.quantity } : x));
  write(SURPLUS_KEY, loadSurplus().map((r) => r.id === d.surplusId ? { ...r, currentStatus: "Rescued / Delivered" } : r));
  write(REQUESTS_KEY, loadRequests().map((r) => r.surplusId === d.surplusId && r.status === "Accepted" ? { ...r, status: "Accepted / Delivered" } : r));
  notify("kitchen", `${d.quantity} ${d.unit.toLowerCase()} were successfully delivered to ${d.ngoName}.`, "accepted");
  notify("ngo", "Delivery completed successfully.", "accepted");
  notify("driver", "Delivery completed successfully.", "accepted");
  return true;
}
export function saveAssessment(id: string, a: Assessment, image?: string) {
  const quality: SurplusRecord["qualityStatus"] = a.screening === "EXPIRED" || a.screening === "REJECTED" ? "Rejected" : a.screening === "REVIEW REQUIRED" ? "Review required" : "Eligible for review";
  write(SURPLUS_KEY, loadSurplus().map((r) => r.id === id ? { ...r, assessment: a, image: image ?? r.image, quantity: a.estimatedPortions, estimatedWeight: a.estimatedWeight, qualityStatus: quality } : r));
}
export const roleOf = (n: KitchenNotification): NotifRole => n.role ?? "kitchen";
export function markNotificationsRead(role: NotifRole = "kitchen") { write(NOTIFS_KEY, loadNotifications().map((n) => roleOf(n) === role ? { ...n, read: true } : n)); }

/** Subscribes to the shared store; data loads after hydration to avoid SSR mismatches. */
export function useSharedStore() {
  const [state, setState] = useState<{ surplus: SurplusRecord[]; requests: NgoRequest[]; notifications: KitchenNotification[]; deliveries: Delivery[]; ready: boolean }>({ surplus: [], requests: [], notifications: [], deliveries: [], ready: false });
  useEffect(() => {
    const sync = () => setState({ surplus: loadSurplus(), requests: loadRequests(), notifications: loadNotifications(), deliveries: loadDeliveries(), ready: true });
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return state;
}

/** Records the NGO can request: not expired, and offered as Available (or Urgent). */
export const isAvailableForNgo = (r: SurplusRecord) =>
  getPriority(r.usableUntil) !== "BLOCKED" && r.qualityStatus !== "Rejected" && (r.currentStatus === "Available" || r.currentStatus === "Urgent" || r.currentStatus === "Available for next recipient");
