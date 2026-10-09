import { ArrowUpRight, Leaf, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { metrics, activity } from "./demo-data";

export type Status = "Available" | "Pending" | "Accepted" | "Urgent" | "Delivered" | "Rejected" | "NGO Accepted" | "Available for next recipient" | "Rescued / Delivered" | "Accepted / Delivered";
const statusClass: Record<Status, string> = {
  Available: "bg-success-soft text-success border-success/15",
  Pending: "bg-warning-soft text-warning border-warning/15",
  Accepted: "bg-success-soft text-success border-success/15",
  Urgent: "bg-danger-soft text-danger border-danger/15",
  Delivered: "bg-info-soft text-info border-info/15",
  Rejected: "bg-danger-soft text-danger border-danger/15",
  "NGO Accepted": "bg-info-soft text-info border-info/15",
  "Available for next recipient": "bg-success-soft text-success border-success/15",
  "Rescued / Delivered": "bg-info-soft text-info border-info/15",
  "Accepted / Delivered": "bg-info-soft text-info border-info/15",
};
export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusClass[status]}`}>{status}</Badge>;
}

export function DemoLabel() {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warning/20 bg-warning-soft px-3 py-1.5 text-[11px] font-bold text-warning"><span className="size-1.5 rounded-full bg-warning" /> Simulated demo data</span>;
}

export function DashboardContent({ compact = false, extraSurplus = 0 }: { compact?: boolean; extraSurplus?: number }) {
  const withSurplus = (m: (typeof metrics)[number]) => m.label === "Current surplus" && extraSurplus ? { ...m, value: String(Number(m.value) + extraSurplus), note: `${extraSurplus} newly registered` } : m;
  return <div className={compact ? "space-y-3" : "space-y-5"}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase text-primary">Kitchen · Harvest Community Kitchen</p>
        <h2 className={`font-display font-bold text-foreground ${compact ? "mt-1 text-xl" : "mt-2 text-2xl sm:text-3xl"}`}>Kitchen overview</h2>
        {!compact && <p className="mt-1 text-sm text-muted-foreground">A snapshot of today's food and rescue activity.</p>}
      </div>
      <DemoLabel />
    </div>

    <div className={`grid grid-cols-2 gap-3 ${compact ? "lg:grid-cols-4" : "xl:grid-cols-4"}`}>
      {metrics.slice(0, 4).map((metric) => <MetricCard key={metric.label} metric={withSurplus(metric)} compact={compact} />)}
    </div>

    <div className={`grid gap-3 ${compact ? "lg:grid-cols-3" : "xl:grid-cols-3"}`}>
      <section className={`surface ${compact ? "lg:col-span-2" : "xl:col-span-2"}`} aria-label="Surplus and rescue trend">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold">Surplus vs rescued</h3>
          <span className="text-xs text-muted-foreground">Last 7 days · demo</span>
        </div>
        <div className={`mt-5 flex items-end justify-between gap-3 border-b border-border pb-2 ${compact ? "h-30" : "h-44"}`}>
          {[{day:"Mon", surplus:55, rescued:40}, {day:"Tue", surplus:70, rescued:53}, {day:"Wed", surplus:48, rescued:42}, {day:"Thu", surplus:82, rescued:61}, {day:"Fri", surplus:60, rescued:52}, {day:"Sat", surplus:74, rescued:65}, {day:"Sun", surplus:90, rescued:70}].map((item) => <div key={item.day} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1" aria-label={`${item.day}: ${item.surplus} surplus, ${item.rescued} rescued`}>
            <div className="w-1/2 max-w-7 rounded-t-sm bg-primary/20" style={{height:`${item.surplus}%`}} />
            <div className="w-1/2 max-w-7 rounded-t-sm bg-primary" style={{height:`${item.rescued}%`}} />
          </div>)}
        </div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day} className="flex-1 text-center">{day}</span>)}</div>
        <div className="mt-4 flex items-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary/20" /> Surplus</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Rescued</span></div>
      </section>
      <section className="surface">
        <div className="flex items-center justify-between"><h3 className="font-display text-sm font-bold">Recent activity</h3><TrendingUp className="size-4 text-primary" /></div>
        <div className="mt-4 divide-y divide-border/70">
          {activity.slice(0, compact ? 3 : 4).map((item) => <div key={item.title} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0"><p className="truncate text-xs font-bold">{item.title}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{item.detail}</p></div>
            <StatusBadge status={item.status} />
          </div>)}
        </div>
      </section>
    </div>
    <div className={`grid grid-cols-2 gap-3 ${compact ? "sm:grid-cols-4" : "xl:grid-cols-4"}`}>
      {metrics.slice(4).map((metric) => <MetricCard key={metric.label} metric={metric} compact={compact} />)}
    </div>
    {!compact && <div className="surface flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-soft text-success"><Leaf className="size-5" /></span><div><p className="font-display text-sm font-bold">Every meal makes a difference</p><p className="mt-1 text-xs text-muted-foreground">The values above are illustrative and do not reflect live operations.</p></div></div>
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">Food rescue impact <ArrowUpRight className="size-4" /></div>
    </div>}
  </div>;
}

export type Metric = { label: string; value: string; unit: string; note: string; kind: string; badge?: Status };
export function MetricCard({ metric, compact = false }: { metric: Metric; compact?: boolean }) {
  return <div className={`surface flex min-h-32 flex-col justify-between ${metric.kind === "highlight" ? "bg-highlight" : ""} ${compact ? "p-3 sm:p-4" : "p-4 sm:p-5"}`}>
    <p className="text-xs font-semibold leading-snug text-muted-foreground">{metric.label}</p>
    <div className="mt-3"><p className={`font-display font-extrabold leading-none ${compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>{metric.value} <span className="font-body text-xs font-semibold text-muted-foreground">{metric.unit}</span></p><div className="mt-2">{metric.label === "Current surplus" || metric.badge ? <StatusBadge status={metric.badge ?? "Available"} /> : <p className="text-[11px] font-medium text-primary">{metric.note}</p>}</div></div>
  </div>;
}
