import type { LucideIcon } from "lucide-react";
import { UserCheck, Truck as Van, FileText, Route as RouteIcon, History, Building2, Users, Shuffle, Package, LayoutDashboard, Boxes, CirclePlus, ScanSearch, HandHeart, Truck, Bell, ChartNoAxesCombined, Settings } from "lucide-react";

export const roles = [
  { id: "admin", title: "Admin", subtitle: "Command center" },
  { id: "driver", title: "Driver", subtitle: "Deliveries" },
] as const;
export type Role = (typeof roles)[number]["id"];
export const isRole = (value: unknown): value is Role => roles.some((role) => role.id === value);

export type Section = string;
type NavItem = { label: Section; icon: LucideIcon };
export const navigationByRole: Record<Role, NavItem[]> = {
  admin: [
    { label: "Dashboard", icon: LayoutDashboard }, { label: "Kitchens", icon: Building2 }, { label: "NGOs", icon: Users },
    { label: "Drivers", icon: Van }, { label: "Registrations", icon: UserCheck }, { label: "Surplus Food", icon: Package },
    { label: "Assessments", icon: ScanSearch }, { label: "Allocations", icon: Shuffle }, { label: "Deliveries", icon: Truck },
    { label: "Notifications", icon: Bell }, { label: "Impact", icon: ChartNoAxesCombined }, { label: "Reports", icon: FileText }, { label: "Settings", icon: Settings },
  ],
  driver: [
    { label: "Dashboard", icon: LayoutDashboard }, { label: "Assigned Deliveries", icon: RouteIcon },
    { label: "Delivery History", icon: History }, { label: "Notifications", icon: Bell }, { label: "Settings", icon: Settings },
  ],
};
export const navigation = navigationByRole.admin;
export const workspaceName: Record<Role, { org: string; initials: string }> = {
  driver: { org: "Ravi Kumar · Driver", initials: "RK" },
  admin: { org: "ResQFood Operations", initials: "RO" },
};

export const metrics = [
  { label: "Today's predicted requirement", value: "320", unit: "meals", note: "Estimated for today", kind: "normal" },
  { label: "Food prepared", value: "384", unit: "meals", note: "64 above predicted need", kind: "normal" },
  { label: "Current surplus", value: "64", unit: "meals", note: "Available to rescue", kind: "highlight" },
  { label: "Food rescued", value: "48", unit: "meals", note: "From today's surplus", kind: "normal" },
  { label: "Active rescue requests", value: "7", unit: "requests", note: "1 marked urgent", kind: "normal" },
  { label: "Pending NGO responses", value: "4", unit: "responses", note: "Awaiting confirmation", kind: "normal" },
  { label: "Active deliveries", value: "3", unit: "deliveries", note: "On the move", kind: "normal" },
  { label: "Food waste prevented", value: "1,240", unit: "kg", note: "Illustrative total to date", kind: "highlight" },
] as const;

export const activity = [
  { title: "Vegetable meal trays", detail: "24 meals · Sunrise Shelter", time: "10:42 AM", status: "Pending" },
  { title: "Fresh lunch portions", detail: "18 meals · Hope Community Kitchen", time: "10:18 AM", status: "Accepted" },
  { title: "Packed rice meals", detail: "20 meals · City Food Bank", time: "09:54 AM", status: "Urgent" },
  { title: "Breakfast packs", detail: "16 meals · Green Leaf Trust", time: "08:35 AM", status: "Delivered" },
] as const;
