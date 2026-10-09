import type { TripStatus } from "@/lib/driver/trips";

const statusMap: Record<string, TripStatus> = {
  "Awaiting driver assignment": "Offered",
  "Driver Assignment Pending": "Offered",
  "Driver Assigned": "Accepted",
  Accepted: "Accepted",
  "At Pickup": "At Pickup",
  "Picked Up": "Picked Up",
  "In Transit": "In Transit",
  "At Delivery": "At Delivery",
  Delivered: "Completed",
  Completed: "Completed",
};

export function tripStatusFromDatabase(status: string | null, rejected = false): TripStatus {
  if (rejected) return "Rejected";
  return statusMap[status ?? "Awaiting driver assignment"] ?? "Unavailable";
}
