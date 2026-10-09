import { useState } from "react";
import { MapPin, Flag, Truck, CheckCircle2, KeyRound, PackageCheck, Clock, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DemoLabel, MetricCard } from "./dashboard-content";
import { fmt, PriorityBadge } from "./surplus";
import { advanceDelivery, verifyDeliveryOtp, useSharedStore, DRIVER, type Delivery, type DeliveryStatus } from "./surplus-store";

const steps: DeliveryStatus[] = ["Driver Assignment Pending", "Driver Assigned", "Ready for Pickup", "Picked Up", "In Transit", "Arrived at Destination", "Delivered"];
const stepLabel: Record<DeliveryStatus, string> = { "Driver Assignment Pending": "Pending", "Driver Assigned": "Assigned", "Ready for Pickup": "Ready", "Picked Up": "Picked up", "In Transit": "In transit", "Arrived at Destination": "Arrived", Delivered: "Delivered" };
const actionLabel: Partial<Record<DeliveryStatus, string>> = { "Driver Assignment Pending": "Accept Assignment", "Driver Assigned": "Mark Ready for Pickup", "Ready for Pickup": "Confirm Pickup", "Picked Up": "Start Delivery", "In Transit": "Arrived at Destination" };

const badgeClass: Record<DeliveryStatus, string> = {
  "Driver Assignment Pending": "bg-warning-soft text-warning border-warning/15",
  "Driver Assigned": "bg-info-soft text-info border-info/15",
  "Ready for Pickup": "bg-info-soft text-info border-info/15",
  "Picked Up": "bg-highlight text-primary border-primary/15",
  "In Transit": "bg-highlight text-primary border-primary/15",
  "Arrived at Destination": "bg-highlight text-primary border-primary/15",
  Delivered: "bg-success-soft text-success border-success/15",
};
export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  return <Badge variant="outline" className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeClass[status]}`}>{status}</Badge>;
}
const isActive = (d: Delivery) => d.status !== "Delivered";
const isToday = (iso: string | null) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const qty = (d: Delivery) => `${d.quantity} ${d.unit.toLowerCase()}`;

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    <DemoLabel />
  </div>;
}
function Empty({ text }: { text: string }) {
  return <div className="surface flex min-h-44 flex-col items-center justify-center text-center"><span className="flex size-12 items-center justify-center rounded-lg bg-highlight text-primary"><Truck className="size-6" /></span><p className="mt-4 text-sm font-semibold">{text}</p></div>;
}

export function Stepper({ status }: { status: DeliveryStatus }) {
  const at = steps.indexOf(status);
  return <ol className="flex items-start">{steps.map((s, i) => <li key={s} className="flex flex-1 flex-col items-center text-center">
    <div className="flex w-full items-center">
      <span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : i <= at ? "bg-primary" : "bg-border"}`} />
      <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i < at || status === "Delivered" ? "bg-primary text-primary-foreground" : i === at ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>{i < at || status === "Delivered" ? <CheckCircle2 className="size-3.5" /> : i + 1}</span>
      <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? "opacity-0" : i < at ? "bg-primary" : "bg-border"}`} />
    </div>
    <span className={`mt-1.5 text-[10px] leading-tight ${i === at ? "font-bold text-primary" : "text-muted-foreground"}`}>{stepLabel[s]}</span>
  </li>)}</ol>;
}

/** Shared delivery table for Kitchen, NGO and Admin views. */
function DeliveryTable({ items, showKitchen }: { items: Delivery[]; showKitchen?: boolean }) {
  const heads = ["Food", "Quantity", ...(showKitchen ? ["Kitchen"] : []), "NGO", "Driver", "Pickup", "Destination", "Status", "Created"];
  return <section className="surface overflow-x-auto p-0"><table className="w-full min-w-220 text-left text-xs">
    <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{heads.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-border/70">{items.map((d) => <tr key={d.id}>
      <td className="px-4 py-3 font-bold">{d.foodName}</td>
      <td className="px-4 py-3 font-semibold">{qty(d)}</td>
      {showKitchen && <td className="px-4 py-3">{d.kitchenName}</td>}
      <td className="px-4 py-3">{d.ngoName}</td>
      <td className="px-4 py-3">{d.assignedDriver ?? <span className="text-muted-foreground">Unassigned</span>}</td>
      <td className="max-w-40 truncate px-4 py-3" title={d.pickupLocation}>{d.pickupLocation}</td>
      <td className="max-w-40 truncate px-4 py-3" title={d.deliveryLocation}>{d.deliveryLocation}</td>
      <td className="px-4 py-3"><DeliveryBadge status={d.status} /></td>
      <td className="px-4 py-3">{fmt(d.createdAt)}</td>
    </tr>)}</tbody>
  </table></section>;
}

export function DeliveriesPage({ role }: { role: "kitchen" | "ngo" | "admin" }) {
  const { deliveries, ready } = useSharedStore();
  const eyebrow = role === "kitchen" ? "Kitchen · Harvest Community Kitchen" : role === "ngo" ? "NGO · Sunrise Shelter" : "Admin · ResQFood Operations";
  return <div className="space-y-5">
    <Header eyebrow={eyebrow} title="Deliveries" subtitle={role === "admin" ? "Every delivery across the network, live." : "Live status of food on its way."} />
    {role === "admin" && <DeliverySummary items={deliveries} />}
    {ready && deliveries.length === 0 ? <Empty text="No deliveries yet. Deliveries appear when an NGO accepts food." /> : <DeliveryTable items={deliveries} showKitchen={role === "admin"} />}
  </div>;
}

export function DeliverySummary({ items }: { items: Delivery[] }) {
  const awaiting = items.filter((d) => ["Driver Assignment Pending", "Driver Assigned", "Ready for Pickup"].includes(d.status)).length;
  const transit = items.filter((d) => ["Picked Up", "In Transit", "Arrived at Destination"].includes(d.status)).length;
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
    <MetricCard metric={{ label: "Active deliveries", value: String(items.filter(isActive).length), unit: "deliveries", note: "Live from shared data", kind: "highlight" }} />
    <MetricCard metric={{ label: "Awaiting pickup", value: String(awaiting), unit: "deliveries", note: "Driver not yet collected", kind: "normal" }} />
    <MetricCard metric={{ label: "In transit", value: String(transit), unit: "deliveries", note: "On the road", kind: "normal" }} />
    <MetricCard metric={{ label: "Completed", value: String(items.filter((d) => !isActive(d)).length), unit: "deliveries", note: "OTP verified", kind: "normal", badge: "Delivered" }} />
  </div>;
}

/** Compact live strip for Kitchen/NGO/Admin dashboards. */
export function LiveDeliveryStrip({ onOpen }: { onOpen: () => void }) {
  const { deliveries } = useSharedStore();
  const latest = deliveries[0];
  if (!latest) return null;
  const done = deliveries.filter((d) => !isActive(d)).length;
  return <section className="surface mb-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Truck className="size-4 text-primary" /><h3 className="font-display text-sm font-bold">Live delivery · {latest.foodName} ({qty(latest)}) → {latest.ngoName}</h3></div>
      <div className="flex items-center gap-2"><span className="text-[11px] text-muted-foreground">{deliveries.filter(isActive).length} active · {done} delivered</span><Button size="sm" variant="outline" onClick={onOpen}>All deliveries</Button></div>
    </div>
    <Stepper status={latest.status} />
  </section>;
}

function OtpForm({ d }: { d: Delivery }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  return <form className="mt-4 rounded-lg border border-primary/25 bg-highlight p-4" onSubmit={(e) => { e.preventDefault(); if (!verifyDeliveryOtp(d.id, otp)) setError("Incorrect OTP. Please try again."); }}>
    <p className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-primary" /> Verify delivery with the recipient's code</p>
    <p className="mt-1 text-[11px] text-muted-foreground">Demo OTP: <span className="font-mono text-sm font-extrabold text-foreground">{d.otp}</span> · no real SMS is sent</p>
    <div className="mt-3 flex gap-2">
      <Input aria-label="Delivery OTP" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }} placeholder="Enter 6-digit OTP" className="max-w-48 font-mono text-base tracking-widest" />
      <Button type="submit" disabled={otp.length !== 6}>Verify OTP</Button>
    </div>
    {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
  </form>;
}

function Stop({ icon, label, name, addr }: { icon: React.ReactNode; label: string; name: string; addr: string }) {
  return <div className="rounded-md border border-border bg-panel/60 p-3">
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-primary">{icon}{label}</p>
    <p className="mt-2 text-sm font-bold">{name}</p><p className="text-[11px] text-muted-foreground">{addr}</p>
  </div>;
}

function ActiveDeliveryCard({ d }: { d: Delivery }) {
  const action = actionLabel[d.status];
  const priority = useSharedStore().surplus.find((s) => s.id === d.surplusId)?.rescuePriority;
  return <section className="surface bg-highlight/40">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><p className="text-[10px] font-bold uppercase text-primary">Active delivery</p><p className="mt-1 font-display text-lg font-bold">{d.foodName} · {qty(d)}</p></div>
      <div className="flex flex-wrap gap-1.5">{priority && <PriorityBadge priority={priority} />}<DeliveryBadge status={d.status} /></div>
    </div>
    <div className="mt-4"><Stepper status={d.status} /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Stop icon={<MapPin className="size-4" />} label="Pickup" name={d.kitchenName} addr={d.pickupLocation} />
      <Stop icon={<Flag className="size-4" />} label="Destination" name={d.ngoName} addr={d.deliveryLocation} />
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Navigation className="size-3.5 text-primary" /> 3.4 km (demo)</span><span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-primary" /> Created {fmt(d.createdAt)}</span>{d.pickupTime && <span className="inline-flex items-center gap-1.5"><PackageCheck className="size-3.5 text-primary" /> Picked up {fmt(d.pickupTime)}</span>}</div>
    {action && <Button size="lg" className="mt-4 w-full sm:w-auto" onClick={() => advanceDelivery(d.id)}>{action}</Button>}
    {d.status === "Arrived at Destination" && <OtpForm d={d} />}
  </section>;
}

export function DriverWorkspace({ view }: { view: "dashboard" | "assigned" | "history" }) {
  const { deliveries, ready } = useSharedStore();
  const mine = deliveries.filter((d) => d.assignedDriver === null || d.assignedDriver === DRIVER);
  const active = mine.filter(isActive);
  const history = mine.filter((d) => !isActive(d));
  const [justDone, setJustDone] = useState<string | null>(null);
  const lastDone = history[0];
  if (lastDone && lastDone.id !== justDone && isToday(lastDone.deliveryTime) && Date.now() - new Date(lastDone.deliveryTime!).getTime() < 4000) setJustDone(lastDone.id);

  if (view === "history") return <div className="space-y-5">
    <Header eyebrow={`Driver · ${DRIVER}`} title="Delivery history" subtitle="Completed, OTP-verified deliveries." />
    {ready && history.length === 0 ? <Empty text="No completed deliveries yet." /> : <section className="surface overflow-x-auto p-0"><table className="w-full min-w-170 text-left text-xs">
      <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{["Food", "Quantity", "Kitchen", "NGO", "Delivered", "Status"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-border/70">{history.map((d) => <tr key={d.id}><td className="px-4 py-3 font-bold">{d.foodName}</td><td className="px-4 py-3">{d.deliveredQuantity ?? d.quantity} {d.unit.toLowerCase()}</td><td className="px-4 py-3">{d.kitchenName}</td><td className="px-4 py-3">{d.ngoName}</td><td className="px-4 py-3">{d.deliveryTime ? fmt(d.deliveryTime) : "—"}</td><td className="px-4 py-3"><DeliveryBadge status={d.status} /></td></tr>)}</tbody>
    </table></section>}
  </div>;

  return <div className="space-y-5">
    <Header eyebrow={`Driver · ${DRIVER}`} title={view === "dashboard" ? "Today's route" : "Assigned deliveries"} subtitle="Work through each step; the kitchen and NGO see updates instantly." />
    {justDone && <div role="status" className="surface flex items-center gap-3 border-success/30 py-3"><CheckCircle2 className="size-5 text-success" /><p className="text-sm font-semibold">Delivery completed successfully.</p><Button size="sm" variant="ghost" className="ml-auto" onClick={() => setJustDone("dismissed")}>Dismiss</Button></div>}
    {view === "dashboard" && <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard metric={{ label: "Today's assignments", value: String(mine.filter((d) => isToday(d.createdAt)).length), unit: "trips", note: "Live from shared data", kind: "normal" }} />
      <MetricCard metric={{ label: "Pending pickup", value: String(active.filter((d) => ["Driver Assignment Pending", "Driver Assigned", "Ready for Pickup"].includes(d.status)).length), unit: "trips", note: "Waiting at kitchens", kind: "normal" }} />
      <MetricCard metric={{ label: "In transit", value: String(active.filter((d) => ["Picked Up", "In Transit", "Arrived at Destination"].includes(d.status)).length), unit: "trips", note: "On the road", kind: "highlight" }} />
      <MetricCard metric={{ label: "Completed today", value: String(history.filter((d) => isToday(d.deliveryTime)).length), unit: "trips", note: "OTP verified", kind: "normal", badge: "Delivered" }} />
    </div>}
    {ready && active.length === 0 ? <Empty text="No active assignments. New deliveries appear when an NGO accepts food." /> : (view === "dashboard" ? active.slice(0, 1) : active).map((d) => <ActiveDeliveryCard key={d.id} d={d} />)}
    {view === "dashboard" && active.length > 1 && <p className="text-xs text-muted-foreground">+{active.length - 1} more in Assigned Deliveries.</p>}
  </div>;
}
