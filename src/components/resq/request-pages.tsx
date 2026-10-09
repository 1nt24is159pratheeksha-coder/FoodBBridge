import { Bell, CheckCircle2, XCircle, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoLabel, StatusBadge, type Status } from "./dashboard-content";
import { PriorityBadge, fmt, getPriority } from "./surplus";
import { markNotificationsRead, roleOf, useSharedStore, NGO, type NgoRequest, type NotifRole, type SurplusRecord } from "./surplus-store";

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase text-primary">{eyebrow}</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    <DemoLabel />
  </div>;
}
function Empty({ text }: { text: string }) {
  return <div className="surface flex min-h-48 flex-col items-center justify-center text-center"><span className="flex size-12 items-center justify-center rounded-lg bg-highlight text-primary"><ClipboardList className="size-6" /></span><p className="mt-4 text-sm font-semibold">{text}</p></div>;
}
function Table({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return <section className="surface overflow-x-auto p-0"><table className="w-full min-w-170 text-left text-xs">
    <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{heads.map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-border/70">{children}</tbody>
  </table></section>;
}
const join = (requests: NgoRequest[], surplus: SurplusRecord[]) =>
  requests.flatMap((r) => { const s = surplus.find((x) => x.id === r.surplusId); return s ? [{ r, s }] : []; });

export function KitchenNgoRequests() {
  const { requests, surplus, ready } = useSharedStore();
  const rows = join(requests, surplus);
  return <div className="space-y-5">
    <Header eyebrow="Kitchen · Harvest Community Kitchen" title="NGO requests" subtitle="Responses from recipients to your surplus offers." />
    {ready && rows.length === 0 ? <Empty text="No NGO responses yet." /> : <Table heads={["Food", "Quantity", "NGO", "Request time", "Rescue priority", "Request status"]}>
      {rows.map(({ r, s }) => <tr key={r.id}>
        <td className="px-4 py-3 font-bold">{s.foodName}</td>
        <td className="px-4 py-3 font-semibold">{r.requestedQuantity ?? s.quantity} {s.unit.toLowerCase()}</td>
        <td className="px-4 py-3">{r.ngoName}</td>
        <td className="px-4 py-3">{fmt(r.createdAt)}</td>
        <td className="px-4 py-3"><PriorityBadge priority={getPriority(s.usableUntil)} /></td>
        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
      </tr>)}
    </Table>}
  </div>;
}


export function NgoMyRequests() {
  const { requests, surplus, deliveries, ready } = useSharedStore();
  const deliveryFor = (r: NgoRequest) => r.status === "Rejected" ? "—" : r.status === "Pending" ? "Not scheduled" : deliveries.find((d) => d.surplusId === r.surplusId)?.status ?? "Awaiting driver";
  const rows = join(requests.filter((r) => r.ngoName === NGO.name), surplus);
  return <div className="space-y-5">
    <Header eyebrow={`NGO · ${NGO.name}`} title="My requests" subtitle="Food offers you have accepted or declined." />
    {ready && rows.length === 0 ? <Empty text="You haven't responded to any offers yet." /> : <Table heads={["Food", "Kitchen", "Quantity", "Request status", "Request time", "Delivery status"]}>
      {rows.map(({ r, s }) => <tr key={r.id}>
        <td className="px-4 py-3 font-bold">{s.foodName}</td>
        <td className="px-4 py-3">{s.kitchenName}</td>
        <td className="px-4 py-3 font-semibold">{r.requestedQuantity ?? s.quantity} {s.unit.toLowerCase()}</td>
        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
        <td className="px-4 py-3">{fmt(r.createdAt)}</td>
        <td className="px-4 py-3 text-muted-foreground">{deliveryFor(r)}</td>
      </tr>)}
    </Table>}
  </div>;
}

const eyebrows: Record<NotifRole | "all", string> = { all: "Admin · All channels", kitchen: "Kitchen · Harvest Community Kitchen", ngo: `NGO · ${NGO.name}`, driver: "Driver · Ravi Kumar" };
export function KitchenNotifications({ role = "kitchen" }: { role?: NotifRole | "all" }) {
  const { notifications: all, ready } = useSharedStore();
  const notifications = all.filter((n) => role === "all" || roleOf(n) === role);
  return <div className="space-y-5">
    <Header eyebrow={eyebrows[role]} title="Notifications" subtitle="Live updates on surplus offers and deliveries." />
    {ready && notifications.length === 0 ? <Empty text="No notifications yet." /> : <section className="surface divide-y divide-border/70 py-2">{notifications.map((n) => <NotificationRow key={n.id} kind={n.kind} message={n.message} time={n.createdAt} unread={!n.read} />)}</section>}
  </div>;
}

function NotificationRow({ kind, message, time, unread }: { kind: "accepted" | "rejected" | "delivery"; message: string; time: string; unread?: boolean }) {
  return <div className="flex items-center gap-3 py-3">
    {kind === "accepted" ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : kind === "delivery" ? <Bell className="size-5 shrink-0 text-primary" /> : <XCircle className="size-5 shrink-0 text-danger" />}
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{message}</p><p className="text-[11px] text-muted-foreground">{fmt(time)}</p></div>
    {unread && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
  </div>;
}

/** Banner shown across the Kitchen workspace for unread NGO responses. */
export function KitchenAlert({ onOpen, role = "kitchen" }: { onOpen: () => void; role?: NotifRole }) {
  const { notifications } = useSharedStore();
  const unread = notifications.filter((n) => !n.read && roleOf(n) === role);
  const latest = unread[0];
  if (!latest) return null;
  return <div role="status" className="surface mb-5 flex flex-wrap items-center gap-3 border-primary/25 py-3">
    <span className="flex size-9 items-center justify-center rounded-lg bg-highlight text-primary"><Bell className="size-4" /></span>
    <div className="min-w-0 flex-1"><p className="text-sm font-bold">{latest.message}</p>{unread.length > 1 && <p className="text-[11px] text-muted-foreground">+{unread.length - 1} more update{unread.length > 2 ? "s" : ""}</p>}</div>
    <Button size="sm" variant="outline" onClick={onOpen}>View all</Button>
    <Button size="sm" variant="ghost" onClick={() => markNotificationsRead(role)}>Dismiss</Button>
  </div>;
}

export type { Status };
