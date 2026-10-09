import type { ReactNode } from "react";
import { MapPin, Navigation, Clock, Flag, Building2, Users, AlertTriangle } from "lucide-react";
import { DemoLabel, MetricCard, StatusBadge, type Metric, type Status } from "./dashboard-content";

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="text-xs font-bold uppercase text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
    <DemoLabel />
  </div>;
}

function Metrics({ items }: { items: Metric[] }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{items.map((m) => <MetricCard key={m.label} metric={m} />)}</div>;
}

function Panel({ title, meta, children, className = "" }: { title: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>
    <div className="flex items-center justify-between gap-2"><h3 className="font-display text-sm font-bold">{title}</h3>{meta && <span className="text-xs text-muted-foreground">{meta}</span>}</div>
    <div className="mt-4">{children}</div>
  </section>;
}

type Row = { title: string; detail: string; status: Status; extra?: string };
function RowList({ rows }: { rows: Row[] }) {
  return <div className="divide-y divide-border/70">{rows.map((r) => <div key={r.title + r.detail} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
    <div className="min-w-0"><p className="truncate text-xs font-bold">{r.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{r.detail}</p></div>
    <div className="flex shrink-0 items-center gap-2">{r.extra && <span className="hidden text-[11px] font-semibold text-muted-foreground sm:inline">{r.extra}</span>}<StatusBadge status={r.status} /></div>
  </div>)}</div>;
}

function Bars({ data, label }: { data: { k: string; v: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.v));
  return <div>
    <div className="flex h-40 items-end justify-between gap-3 border-b border-border pb-2" aria-label={label}>
      {data.map((d) => <div key={d.k} className="flex h-full flex-1 items-end justify-center"><div className="w-full max-w-9 rounded-t-sm bg-primary" style={{ height: `${(d.v / max) * 100}%` }} title={`${d.k}: ${d.v}`} /></div>)}
    </div>
    <div className="mt-2 flex justify-between gap-3 text-[11px] text-muted-foreground">{data.map((d) => <span key={d.k} className="flex-1 text-center">{d.k}</span>)}</div>
  </div>;
}

export function NgoDashboard() {
  return <div className="space-y-5">
    <Header eyebrow="NGO · Sunrise Shelter" title="Recipient overview" subtitle="Food offers near you and what is on its way." />
    <Metrics items={[
      { label: "Available food nearby", value: "92", unit: "meals", note: "Within 5 km", kind: "highlight", badge: "Available" },
      { label: "Pending food offers", value: "5", unit: "offers", note: "Awaiting your response", kind: "normal" },
      { label: "Accepted food", value: "46", unit: "meals", note: "3 offers confirmed", kind: "normal" },
      { label: "Active deliveries", value: "2", unit: "deliveries", note: "Arriving within 40 min", kind: "normal" },
    ]} />
    <div className="grid gap-3 xl:grid-cols-3">
      <Panel title="Urgent rescue opportunities" meta={<span className="inline-flex items-center gap-1 text-danger"><AlertTriangle className="size-3.5" /> Act soon</span>} className="xl:col-span-2">
        <RowList rows={[
          { title: "Packed rice meals · 20 meals", detail: "Harvest Community Kitchen · 1.8 km", status: "Urgent", extra: "Best before 1:30 PM" },
          { title: "Dal & chapati · 30 meals", detail: "St. Mary's Hospital Canteen · 3.2 km", status: "Urgent", extra: "Best before 2:15 PM" },
          { title: "Fruit cups · 25 portions", detail: "Tech Park Cafeteria · 4.6 km", status: "Available", extra: "Best before 5:00 PM" },
        ]} />
      </Panel>
      <Panel title="Today's received meals">
        <p className="font-display text-4xl font-extrabold">138 <span className="font-body text-xs font-semibold text-muted-foreground">meals</span></p>
        <p className="mt-1 text-[11px] font-medium text-primary">Target 180 · 77% reached</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-primary/15"><div className="h-full w-[77%] rounded-full bg-primary" /></div>
      </Panel>
    </div>
    <Panel title="Pending & accepted offers" meta="Today · demo">
      <RowList rows={[
        { title: "Vegetable meal trays · 24 meals", detail: "Harvest Community Kitchen", status: "Pending" },
        { title: "Fresh lunch portions · 18 meals", detail: "Green Bowl Catering", status: "Accepted" },
        { title: "Breakfast packs · 16 meals", detail: "City University Mess", status: "Delivered" },
      ]} />
    </Panel>
  </div>;
}

export function DriverDashboard() {
  return <div className="space-y-5">
    <Header eyebrow="Driver · Ravi Kumar" title="Today's route" subtitle="Your current pickup and drop-off at a glance." />
    <div className="grid gap-3 xl:grid-cols-3">
      <Panel title="Assigned pickup" meta={<StatusBadge status="Accepted" />} className="bg-highlight xl:col-span-2">
        <p className="font-display text-lg font-bold">Vegetable meal trays · 24 meals</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Stop icon={<MapPin className="size-4" />} label="Pickup location" name="Harvest Community Kitchen" addr="12 MG Road, Indiranagar" time="Ready at 11:15 AM" />
          <Stop icon={<Flag className="size-4" />} label="Recipient location" name="Sunrise Shelter" addr="45 Lake View Street, Domlur" time="Drop by 11:50 AM" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Navigation className="size-3.5 text-primary" /> 3.4 km</span><span className="inline-flex items-center gap-1.5"><Clock className="size-3.5 text-primary" /> ~14 min drive</span></div>
      </Panel>
      <Panel title="Delivery status">
        <ol className="space-y-3">{[["Assigned", true], ["Picked up", true], ["In transit", false], ["Delivered", false]].map(([s, done], i) => <li key={String(s)} className="flex items-center gap-3 text-xs">
          <span className={`flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${done ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>{i + 1}</span>
          <span className={done ? "font-bold" : "text-muted-foreground"}>{String(s)}</span>
        </li>)}</ol>
      </Panel>
    </div>
    <Metrics items={[
      { label: "Today's deliveries", value: "6", unit: "trips", note: "2 remaining", kind: "normal" },
      { label: "Completed deliveries", value: "4", unit: "trips", note: "All on time", kind: "highlight", badge: "Delivered" },
      { label: "Meals transported", value: "112", unit: "meals", note: "Today", kind: "normal" },
      { label: "Distance covered", value: "27", unit: "km", note: "Today", kind: "normal" },
    ]} />
    <Panel title="Today's deliveries" meta="Demo schedule">
      <RowList rows={[
        { title: "Harvest Community Kitchen → Sunrise Shelter", detail: "24 meals · 11:15 AM", status: "Accepted" },
        { title: "Green Bowl Catering → Hope Community Kitchen", detail: "18 meals · 1:00 PM", status: "Pending" },
        { title: "City University Mess → Green Leaf Trust", detail: "16 meals · 8:35 AM", status: "Delivered" },
      ]} />
    </Panel>
  </div>;
}

function Stop({ icon, label, name, addr, time }: { icon: ReactNode; label: string; name: string; addr: string; time: string }) {
  return <div className="rounded-md border border-border bg-panel/60 p-3">
    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-primary">{icon}{label}</p>
    <p className="mt-2 text-sm font-bold">{name}</p><p className="text-[11px] text-muted-foreground">{addr}</p>
    <p className="mt-2 text-[11px] font-semibold text-primary">{time}</p>
  </div>;
}

export function AdminDashboard() {
  return <div className="space-y-5">
    <Header eyebrow="Admin · ResQFood Operations" title="Platform overview" subtitle="Network-wide surplus, rescue and delivery activity." />
    <Metrics items={[
      { label: "Total kitchens", value: "42", unit: "kitchens", note: "+3 this month", kind: "normal" },
      { label: "Total NGOs", value: "28", unit: "partners", note: "24 active today", kind: "normal" },
      { label: "Active surplus", value: "310", unit: "meals", note: "Across 11 kitchens", kind: "highlight", badge: "Available" },
      { label: "Food rescued", value: "1,860", unit: "meals", note: "This week", kind: "normal" },
    ]} />
    <div className="grid gap-3 xl:grid-cols-3">
      <Panel title="Meals rescued per day" meta="Last 7 days · demo" className="xl:col-span-2">
        <Bars label="Meals rescued per day" data={[{ k: "Mon", v: 210 }, { k: "Tue", v: 260 }, { k: "Wed", v: 240 }, { k: "Thu", v: 310 }, { k: "Fri", v: 280 }, { k: "Sat", v: 300 }, { k: "Sun", v: 260 }]} />
      </Panel>
      <Panel title="Overall impact">
        <div className="space-y-4">
          {[["Food waste prevented", "18.4 t"], ["Meals served", "46,200"], ["CO₂e avoided", "32 t"]].map(([k, v]) => <div key={k}><p className="text-[11px] font-semibold text-muted-foreground">{k}</p><p className="font-display text-2xl font-extrabold">{v}</p></div>)}
          <p className="text-[11px] text-muted-foreground">Illustrative totals to date.</p>
        </div>
      </Panel>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <MetricCard metric={{ label: "Active deliveries", value: "9", unit: "deliveries", note: "6 drivers on route", kind: "normal" }} />
      <MetricCard metric={{ label: "Completed rescues", value: "214", unit: "rescues", note: "This month", kind: "normal", badge: "Delivered" }} />
    </div>
    <Panel title="Latest allocations" meta={<span className="inline-flex items-center gap-3"><span className="inline-flex items-center gap-1"><Building2 className="size-3.5" /> Kitchen</span><span className="inline-flex items-center gap-1"><Users className="size-3.5" /> NGO</span></span>}>
      <RowList rows={[
        { title: "Harvest Community Kitchen → Sunrise Shelter", detail: "24 meals · Driver Ravi K.", status: "Accepted" },
        { title: "St. Mary's Hospital Canteen → unassigned", detail: "30 meals · awaiting NGO", status: "Urgent" },
        { title: "Green Bowl Catering → Hope Community Kitchen", detail: "18 meals · awaiting driver", status: "Pending" },
        { title: "City University Mess → Green Leaf Trust", detail: "16 meals · Driver Asha M.", status: "Delivered" },
      ]} />
    </Panel>
  </div>;
}
