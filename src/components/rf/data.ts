// Phase 1 mock data. Replace with backend reads in later phases; shapes mirror the planned entities.
export type FlowStatus = "Available" | "Validating" | "Matching" | "NGO Confirmation" | "NGO Confirmed" | "Driver Assigned" | "In Transit" | "Delivered" | "Expired";

/** Operational pipeline shown on Admin → Operations, in order. */
export const pipeline: { status: FlowStatus; label: string }[] = [
  { status: "Available", label: "Surplus" },
  { status: "Validating", label: "Validating" },
  { status: "Matching", label: "Matching" },
  { status: "NGO Confirmation", label: "Awaiting NGO" },
  { status: "NGO Confirmed", label: "NGO Confirmed" },
  { status: "Driver Assigned", label: "Driver Assigned" },
  { status: "In Transit", label: "In Transit" },
  { status: "Delivered", label: "Delivered" },
];
export const isActiveFlow = (s: FlowStatus) => s !== "Delivered" && s !== "Expired";

export type Surplus = {
  id: string; kitchen: string; food: string; quantity: string; weightKg: number; preparedAt: string; availableUntil: string;
  /** Minutes left in the redistribution window when the demo loads (null once closed). */
  windowMinutes: number | null;
  storage: string; quality: string; location: string; status: FlowStatus;
  ngo?: string; driver?: string; deliveryId?: string;
  ai?: { food: string; foodConf: number; portions: string; weight: string; qtyConf: number; visual: string; visualConf: number; window: string; eligible: boolean };
};

export const surplus: Surplus[] = [
  { id: "SUR-1042", kitchen: "Fresh Bites Cafe", food: "Vegetarian Rice", quantity: "50 portions", weightKg: 25, preparedAt: "1:30 PM", availableUntil: "6:00 PM", windowMinutes: 102, storage: "Hot holding (>63°C)", quality: "No obvious visible issue", location: "Indiranagar, Bengaluru", status: "In Transit", ngo: "Feed The City", driver: "Arjun", deliveryId: "TRIP-501",
    ai: { food: "Vegetarian Rice", foodConf: 94, portions: "50 portions", weight: "25 kg", qtyConf: 88, visual: "No obvious visible issue", visualConf: 90, window: "4 h 30 min from preparation", eligible: true } },
  { id: "SUR-1043", kitchen: "Green Kitchen", food: "Cooked Meals", quantity: "40 kg", weightKg: 40, preparedAt: "2:10 PM", availableUntil: "7:30 PM", windowMinutes: 130, storage: "Hot holding", quality: "No obvious visible issue", location: "Koramangala, Bengaluru", status: "Matching",
    ai: { food: "Dal with Roti", foodConf: 91, portions: "80 meals", weight: "40 kg", qtyConf: 84, visual: "No obvious visible issue", visualConf: 87, window: "5 h from preparation", eligible: true } },
  { id: "SUR-1046", kitchen: "City Hospital Kitchen", food: "Rice Meals", quantity: "30 portions", weightKg: 12, preparedAt: "2:45 PM", availableUntil: "8:30 PM", windowMinutes: 185, storage: "Hot holding", quality: "No obvious visible issue", location: "MG Road, Bengaluru", status: "NGO Confirmation", ngo: "Annapurna Trust",
    ai: { food: "Steamed Rice with Sambar", foodConf: 89, portions: "30 portions", weight: "12 kg", qtyConf: 82, visual: "No obvious visible issue", visualConf: 88, window: "5 h 45 min from preparation", eligible: true } },
  { id: "SUR-1044", kitchen: "Campus Canteen", food: "Vegetable Pulao", quantity: "30 portions", weightKg: 12, preparedAt: "12:00 PM", availableUntil: "4:30 PM", windowMinutes: 150, storage: "Hot holding", quality: "No obvious visible issue", location: "Jayanagar, Bengaluru", status: "NGO Confirmed", ngo: "Hope Shelter",
    ai: { food: "Vegetable Pulao", foodConf: 92, portions: "30 portions", weight: "12 kg", qtyConf: 86, visual: "No obvious visible issue", visualConf: 89, window: "4 h 30 min from preparation", eligible: true } },
  { id: "SUR-1047", kitchen: "Hotel Grand Spice", food: "Chapati & Sabzi", quantity: "45 portions", weightKg: 15, preparedAt: "3:00 PM", availableUntil: "8:00 PM", windowMinutes: 210, storage: "Hot holding", quality: "No obvious visible issue", location: "Whitefield, Bengaluru", status: "Driver Assigned", ngo: "Little Hearts Home", driver: "Meera", deliveryId: "TRIP-502",
    ai: { food: "Chapati with Mixed Veg", foodConf: 90, portions: "45 portions", weight: "15 kg", qtyConf: 83, visual: "No obvious visible issue", visualConf: 91, window: "5 h from preparation", eligible: true } },
  { id: "SUR-1045", kitchen: "City Hospital Kitchen", food: "Bread & Bakery", quantity: "60 pieces", weightKg: 9, preparedAt: "8:00 AM", availableUntil: "9:00 PM", windowMinutes: 480, storage: "Room temperature", quality: "Validating photo", location: "MG Road, Bengaluru", status: "Validating" },
  { id: "SUR-1048", kitchen: "Green Kitchen", food: "Idli & Sambar", quantity: "25 portions", weightKg: 8, preparedAt: "3:20 PM", availableUntil: "7:20 PM", windowMinutes: 240, storage: "Hot holding", quality: "Pending assessment", location: "Koramangala, Bengaluru", status: "Available" },
  { id: "SUR-1040", kitchen: "Fresh Bites Cafe", food: "Paneer Curry", quantity: "35 portions", weightKg: 14, preparedAt: "11:30 AM", availableUntil: "3:00 PM", windowMinutes: null, storage: "Hot holding", quality: "No obvious visible issue", location: "Indiranagar, Bengaluru", status: "Delivered", ngo: "Little Hearts Home", driver: "Meera", deliveryId: "TRIP-498" },
  { id: "SUR-1039", kitchen: "Hotel Grand Spice", food: "Mixed Salad", quantity: "20 portions", weightKg: 6, preparedAt: "9:00 AM", availableUntil: "1:00 PM", windowMinutes: null, storage: "Refrigerated", quality: "Window elapsed", location: "Whitefield, Bengaluru", status: "Expired" },
];

/** Extra profile fields for organizations; verification status comes from the automated verification store. */
export const orgProfiles: Record<string, { type?: string; foods?: string; capacityKg?: number }> = {
  "Fresh Bites Cafe": { type: "Restaurant" }, "Green Kitchen": { type: "Cloud kitchen" }, "Campus Canteen": { type: "Institutional" },
  "City Hospital Kitchen": { type: "Hospital" }, "Hotel Grand Spice": { type: "Hotel" }, "Unknown Kitchen": { type: "Restaurant" }, "Quick Meals Stall": { type: "Street food" },
  "Feed The City": { foods: "Cooked meals, Bakery", capacityKg: 120 }, "Hope Shelter": { foods: "Cooked meals", capacityKg: 80 },
  "Little Hearts Home": { foods: "Vegetarian only", capacityKg: 40 }, "Annapurna Trust": { foods: "All types", capacityKg: 60 }, "Helping Hands Foundation": { foods: "All types", capacityKg: 50 },
};

export const drivers = [
  { name: "Arjun Kumar", vehicle: "Bike · KA-03-1122", phone: "+91 98451 20987", zone: "Central", online: true, trip: "TRIP-501" },
  { name: "Meera", vehicle: "Van · KA-01-9087", phone: "+91 99015 76234", zone: "East", online: true, trip: "TRIP-502" },
  { name: "Ravi", vehicle: "Bike · KA-05-4410", phone: "+91 97316 54120", zone: "South", online: false, trip: "—" },
];

export const impactWeekly = [
  { day: "Mon", kg: 42 }, { day: "Tue", kg: 58 }, { day: "Wed", kg: 37 }, { day: "Thu", kg: 66 }, { day: "Fri", kg: 71 }, { day: "Sat", kg: 49 }, { day: "Sun", kg: 63 },
];
// Common estimate: ~2.5 kg CO2e avoided per kg of food not wasted (illustrative factor).
export const CO2E_PER_KG = 2.5;
