/**
 * ResQFood core entities. The website (Admin + Driver) and the future WhatsApp
 * assistant (Kitchen + NGO) operate on these same records. Today they live in
 * browser storage (surplus-store.ts); a real database will adopt these shapes.
 */
export type Channel = "web" | "whatsapp";
export type UserRole = "admin" | "driver" | "kitchen" | "recipient";
export type RegistrationStatus = "pending" | "approved" | "rejected";

export const lifecycleStages = ["PREDICT", "PLAN", "MONITOR", "RESCUE", "ASSESS", "ALLOCATE", "DELIVER", "MEASURE", "LEARN"] as const;
export type LifecycleStage = (typeof lifecycleStages)[number];

export const surplusStates = [
  "SURPLUS_CREATED", "ASSESSMENT_PENDING", "ASSESSMENT_COMPLETE", "AVAILABLE", "NGO_NOTIFIED", "ACCEPTED", "REJECTED",
  "ALLOCATED", "DRIVER_ASSIGNED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "OTP_VERIFICATION", "DELIVERED", "IMPACT_UPDATED",
] as const;
export type SurplusState = (typeof surplusStates)[number];

export interface User { id: string; name: string; phone: string; role: UserRole; channel: Channel; createdAt: string }
export interface Kitchen { id: string; userId: string; name: string; contactName: string; phone: string; address: string; dailyMeals: number; status: RegistrationStatus; channel: Channel; joinedAt: string }
export interface Recipient { id: string; userId: string; name: string; contactName: string; phone: string; address: string; capacityMeals: number; foodRequirements: string[]; availability: string; status: RegistrationStatus; channel: Channel; joinedAt: string }
export interface Driver { id: string; userId: string; name: string; phone: string; vehicle: string; zone: string; available: boolean; status: RegistrationStatus }
export interface SurplusFood { id: string; kitchenId: string; foodName: string; quantity: number; unit: string; estimatedWeightKg: number; preparedAt: string; usableUntil: string; category: string; storageCondition: string; pickupLocation: string; imageUrl?: string; state: SurplusState; source: Channel; createdAt: string }
export interface FoodAssessment { id: string; surplusId: string; foodDetected: string; estimatedPortions: number; estimatedWeightKg: number; quantityConfidence: number; visualConfidence: number; screening: "ELIGIBLE FOR REVIEW" | "REVIEW REQUIRED" | "URGENT" | "EXPIRED" | "REJECTED"; notes: string[]; confirmedByUser: boolean; createdAt: string }
export interface Allocation { id: string; surplusId: string; recipientId: string; quantity: number; status: "NOTIFIED" | "ACCEPTED" | "REJECTED" | "ALLOCATED" | "DELIVERED"; respondedAt?: string; createdAt: string }
export interface DeliveryEntity { id: string; allocationId: string; surplusId: string; driverId: string | null; status: SurplusState; otp: string; pickupTime?: string; deliveryTime?: string; createdAt: string }
export interface NotificationEntity { id: string; userId: string; channel: Channel; message: string; read: boolean; createdAt: string }
export interface ImpactMetric { id: string; date: string; mealsRescued: number; kgRescued: number; co2AvoidedKg: number; deliveriesCompleted: number }
export interface WhatsAppMessage { id: string; userId: string; direction: "inbound" | "outbound"; type: "text" | "voice" | "image"; body: string; mediaUrl?: string; createdAt: string }

/** Demo directory (simulated). Kitchens and NGOs register through WhatsApp in the final system. */
export const demoKitchens: Kitchen[] = [
  { id: "k1", userId: "u1", name: "Harvest Community Kitchen", contactName: "Meera Nair", phone: "+91 98450 11220", address: "12 MG Road, Bengaluru", dailyMeals: 400, status: "approved", channel: "whatsapp", joinedAt: "2026-07-02" },
  { id: "k2", userId: "u2", name: "St. Anne's Hospital Canteen", contactName: "Joseph D'Souza", phone: "+91 98861 44310", address: "Richmond Town, Bengaluru", dailyMeals: 650, status: "approved", channel: "whatsapp", joinedAt: "2026-07-19" },
  { id: "k3", userId: "u3", name: "TechPark Cafeteria B", contactName: "Arjun Rao", phone: "+91 99001 87654", address: "Whitefield, Bengaluru", dailyMeals: 900, status: "approved", channel: "whatsapp", joinedAt: "2026-08-05" },
  { id: "k4", userId: "u4", name: "Green Valley School Mess", contactName: "Lakshmi Iyer", phone: "+91 97400 22119", address: "Jayanagar, Bengaluru", dailyMeals: 300, status: "pending", channel: "whatsapp", joinedAt: "2026-10-01" },
];
export const demoRecipients: Recipient[] = [
  { id: "r1", userId: "u5", name: "Sunrise Shelter", contactName: "Fatima Khan", phone: "+91 98440 66771", address: "45 Lake View Street, Domlur", capacityMeals: 120, foodRequirements: ["Cooked meals", "Rice"], availability: "8 AM – 9 PM", status: "approved", channel: "whatsapp", joinedAt: "2026-07-04" },
  { id: "r2", userId: "u6", name: "City Food Bank", contactName: "Rahul Menon", phone: "+91 99860 33412", address: "Shivajinagar, Bengaluru", capacityMeals: 300, foodRequirements: ["Any"], availability: "24 hours", status: "approved", channel: "whatsapp", joinedAt: "2026-07-21" },
  { id: "r3", userId: "u7", name: "Hope Children's Home", contactName: "Sr. Grace", phone: "+91 97411 90023", address: "Koramangala, Bengaluru", capacityMeals: 60, foodRequirements: ["Vegetarian", "Bakery"], availability: "11 AM – 7 PM", status: "pending", channel: "whatsapp", joinedAt: "2026-10-02" },
];
export const demoDrivers: Driver[] = [
  { id: "d1", userId: "u8", name: "Ravi Kumar", phone: "+91 98451 20987", vehicle: "Insulated van · KA-01-AB-4521", zone: "Central", available: true, status: "approved" },
  { id: "d2", userId: "u9", name: "Sameer Ali", phone: "+91 99015 76234", vehicle: "Two-wheeler with cooler box", zone: "East", available: false, status: "approved" },
  { id: "d3", userId: "u10", name: "Priya S", phone: "+91 97316 54120", vehicle: "Hatchback · KA-03-MN-1180", zone: "South", available: true, status: "pending" },
];
