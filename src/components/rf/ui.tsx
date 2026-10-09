import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const tone: Record<string, string> = {
  success: "bg-success-soft text-success", warning: "bg-warning-soft text-warning", danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info", teal: "bg-teal-soft text-teal", muted: "bg-muted text-muted-foreground",
};
const statusTone: Record<string, keyof typeof tone> = {
  Available: "success", Validating: "info", Matching: "warning", "NGO Confirmation": "warning", "NGO Confirmed": "success", Accepted: "teal",
  "Driver Assigned": "teal", "In Transit": "info", Delivered: "success", Completed: "success", Expired: "danger",
  "AI Verified": "success", Verified: "success", Pending: "warning", Rejected: "danger", Online: "success", Offline: "muted", Active: "success", Eligible: "success",
  Offered: "warning", "At Pickup": "info", "At Delivery": "info",
};

export function StatusPill({ status }: { status: string }) {
  const t = tone[statusTone[status] ?? "muted"];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${t}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>;
}

export function PageTitle({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>{eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-primary">{eyebrow}</p>}<h1 className="mt-1 font-display text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
    {actions}
  </div>;
}

export function Kpi({ label, value, unit, icon: Icon, note }: { label: string; value: string; unit?: string; icon: LucideIcon; note?: string }) {
  return <div className="surface">
    <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="flex size-9 items-center justify-center rounded-lg bg-highlight text-primary"><Icon className="size-4" /></span></div>
    <p className="mt-3 font-display text-3xl font-bold">{value}{unit && <span className="ml-1 text-base font-semibold text-muted-foreground">{unit}</span>}</p>
    {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
  </div>;
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return <div className="surface overflow-x-auto p-0">
    <table className="w-full min-w-[640px] text-sm">
      <thead><tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">{head.map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border last:border-0">{r.map((c, j) => <td key={j} className="px-4 py-3 align-middle">{c}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function MockNote({ children = "Demo data — will be replaced by live records." }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{children}</span>;
}
