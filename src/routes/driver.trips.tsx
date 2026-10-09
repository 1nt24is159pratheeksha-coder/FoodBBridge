import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { StatusPill } from "@/components/rf/ui";
import { DriverWorkspace } from "@/components/resq/deliveries";
import { useTrips } from "@/lib/driver/trips";

export const Route = createFileRoute("/driver/trips")({ head: () => ({ meta: [{ title: "My Trips | ResQFood AI" }] }), component: Trips });

function Trips() {
  const trips = useTrips();
  return <div className="space-y-4">
    <h1 className="font-display text-2xl font-bold">My trips</h1>
    <ul className="space-y-2">{trips.map((t) => <li key={t.id}><Link to="/driver/trip/$id" params={{ id: t.id }} className="surface flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1"><p className="font-semibold">{t.food} · {t.quantity}</p><p className="truncate text-xs text-muted-foreground">{t.id} · {t.kitchen} → {t.ngo}</p></div>
      <StatusPill status={t.status} /><ChevronRight className="size-4 text-muted-foreground" />
    </Link></li>)}</ul>
    {/* Existing shared-store delivery workflow (kitchen/NGO demo flow) stays available here. */}
    <details className="surface"><summary className="cursor-pointer text-sm font-semibold">Deliveries from the kitchen/NGO demo flow</summary><div className="mt-4"><DriverWorkspace view="assigned" /></div></details>
  </div>;
}
