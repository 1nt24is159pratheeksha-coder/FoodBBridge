import { useState } from "react";
import { MessageCircle, Download, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoLabel, MetricCard } from "./dashboard-content";
import { useSharedStore } from "./surplus-store";
import { demoKitchens, demoRecipients, demoDrivers, type RegistrationStatus } from "./entities";

export function PageHeader({ eyebrow = "Admin · ResQFood Operations", title, subtitle }: { eyebrow?: string; title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    <DemoLabel />
  </div>;
}
const regClass: Record<RegistrationStatus, string> = { approved: "bg-success-soft text-success border-success/15", pending: "bg-warning-soft text-warning border-warning/15", rejected: "bg-danger-soft text-danger border-danger/15" };
function RegBadge({ status }: { status: RegistrationStatus }) {
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${regClass[status]}`}>{status}</Badge>;
}
function WhatsAppTag() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold text-success"><MessageCircle className="size-3" />WhatsApp</span>;
}
function Table({ heads, rows }: { heads: string[]; rows: React.ReactNode[][] }) {
  return <section className="surface overflow-x-auto p-0"><table className="w-full min-w-180 text-left text-xs">
    <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{heads.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-border/70">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-3 ${j === 0 ? "font-bold" : ""}`}>{c}</td>)}</tr>)}</tbody>
  </table></section>;
}

export function KitchensPage() {
  return <div className="space-y-5"><PageHeader title="Registered kitchens" subtitle="Kitchens register and log surplus through the WhatsApp assistant." />
    <Table heads={["Kitchen", "Contact", "Phone", "Address", "Daily meals", "Channel", "Status"]} rows={demoKitchens.map((k) => [k.name, k.contactName, k.phone, k.address, k.dailyMeals, <WhatsAppTag />, <RegBadge status={k.status} />])} /></div>;
}
export function NgosPage() {
  return <div className="space-y-5"><PageHeader title="Registered NGOs" subtitle="Recipients receive offers and accept or reject them on WhatsApp." />
    <Table heads={["NGO", "Contact", "Address", "Capacity", "Needs", "Hours", "Channel", "Status"]} rows={demoRecipients.map((r) => [r.name, r.contactName, r.address, `${r.capacityMeals} meals`, r.foodRequirements.join(", "), r.availability, <WhatsAppTag />, <RegBadge status={r.status} />])} /></div>;
}
export function DriversPage() {
  return <div className="space-y-5"><PageHeader title="Drivers" subtitle="Drivers use the ResQFood web app to run deliveries." />
    <Table heads={["Driver", "Phone", "Vehicle", "Zone", "Availability", "Status"]} rows={demoDrivers.map((d) => [d.name, d.phone, d.vehicle, d.zone, d.available ? "On shift" : "Off shift", <RegBadge status={d.status} />])} /></div>;
}

export function RegistrationsPage() {
  const pending = [
    ...demoKitchens.filter((k) => k.status === "pending").map((k) => ({ id: k.id, name: k.name, type: "Kitchen", detail: `${k.dailyMeals} meals/day · ${k.address}`, joined: k.joinedAt })),
    ...demoRecipients.filter((r) => r.status === "pending").map((r) => ({ id: r.id, name: r.name, type: "NGO", detail: `${r.capacityMeals} meal capacity · ${r.address}`, joined: r.joinedAt })),
    ...demoDrivers.filter((d) => d.status === "pending").map((d) => ({ id: d.id, name: d.name, type: "Driver", detail: d.vehicle, joined: "—" })),
  ];
  const [decisions, setDecisions] = useState<Record<string, RegistrationStatus>>({});
  return <div className="space-y-5"><PageHeader title="Pending registrations" subtitle="Review new kitchens, NGOs and drivers before they join the network." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pending.map((p) => <section key={p.id} className="surface space-y-3">
      <div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold uppercase text-primary">{p.type}</p><p className="font-display text-base font-bold">{p.name}</p></div><RegBadge status={decisions[p.id] ?? "pending"} /></div>
      <p className="text-xs text-muted-foreground">{p.detail}</p><p className="text-[11px] text-muted-foreground">Requested {p.joined}</p>
      {!decisions[p.id] && <div className="flex gap-2"><Button size="sm" onClick={() => setDecisions((d) => ({ ...d, [p.id]: "approved" }))}><CheckCircle2 className="size-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => setDecisions((d) => ({ ...d, [p.id]: "rejected" }))}><XCircle className="size-4" />Reject</Button></div>}
    </section>)}</div>
    <p className="text-[11px] text-muted-foreground">Decisions here are for the demo only and reset on refresh.</p>
  </div>;
}

function useImpact() {
  const { deliveries, surplus } = useSharedStore();
  const done = deliveries.filter((d) => d.status === "Delivered");
  const meals = done.filter((d) => /meal|portion/i.test(d.unit)).reduce((n, d) => n + (d.deliveredQuantity ?? d.quantity), 0);
  const kg = done.reduce((n, d) => n + (surplus.find((s) => s.id === d.surplusId)?.estimatedWeight ?? 0), 0);
  return { done, meals, kg, co2: Math.round(kg * 2.5), deliveries, surplus };
}
export function ImpactPage() {
  const { done, meals, kg, co2 } = useImpact();
  return <div className="space-y-5"><PageHeader title="Impact" subtitle="Calculated live from OTP-verified deliveries in the shared data." />
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard metric={{ label: "Meals rescued", value: String(meals), unit: "meals", note: "Delivered and verified", kind: "highlight" }} />
      <MetricCard metric={{ label: "Food rescued", value: String(kg), unit: "kg", note: "Estimated weight", kind: "normal" }} />
      <MetricCard metric={{ label: "CO₂e avoided", value: String(co2), unit: "kg", note: "Demo factor 2.5 kg per kg food", kind: "normal" }} />
      <MetricCard metric={{ label: "Completed deliveries", value: String(done.length), unit: "trips", note: "OTP verified", kind: "normal", badge: "Delivered" }} />
    </div>
  </div>;
}
export function ReportsPage() {
  const { deliveries, surplus } = useImpact();
  const kitchens = Array.from(new Set(surplus.map((s) => s.kitchenName)));
  const rows = kitchens.map((k) => {
    const items = surplus.filter((s) => s.kitchenName === k);
    const delivered = deliveries.filter((d) => d.kitchenName === k && d.status === "Delivered");
    return [k, items.length, items.reduce((n, s) => n + s.estimatedWeight, 0), delivered.length, delivered.reduce((n, d) => n + d.quantity, 0)];
  });
  const exportCsv = () => {
    const csv = [["Kitchen", "Surplus records", "Surplus kg", "Deliveries completed", "Quantity delivered"], ...rows].map((r) => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "resqfood-report.csv"; a.click();
  };
  return <div className="space-y-5"><PageHeader title="Reports" subtitle="Per-kitchen summary of surplus and completed rescues." />
    <Button variant="outline" onClick={exportCsv}><Download className="size-4" />Export CSV</Button>
    <Table heads={["Kitchen", "Surplus records", "Surplus kg", "Deliveries completed", "Quantity delivered"]} rows={rows} />
  </div>;
}

/** Banner explaining that Kitchen/NGO actions shown in admin will come from WhatsApp. */
export function WhatsAppNote({ text }: { text: string }) {
  return <div className="surface flex items-start gap-3 border-success/25 py-3"><MessageCircle className="mt-0.5 size-5 shrink-0 text-success" /><p className="text-xs text-muted-foreground">{text}</p></div>;
}
