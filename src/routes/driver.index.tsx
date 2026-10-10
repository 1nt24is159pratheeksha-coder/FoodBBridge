import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock3, MapPin, PackageCheck, RotateCw, Truck, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/rf/ui";
import { acceptTrip, isActiveTrip, rejectTrip, refreshTrips, useTripState } from "@/lib/driver/trips";

export const Route = createFileRoute("/driver/")({ component: DriverHome });

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Truck }) {
  return <section className="surface flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="font-display text-xl font-bold">{value}</p><p className="truncate text-[10px] text-muted-foreground">{detail}</p></div></section>;
}

function DriverHome() {
  const { trips, loading, error } = useTripState();
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const navigate = useNavigate();
  const offers = trips.filter((t) => t.status === "Offered");
  const active = trips.find(isActiveTrip);
  const completed = trips.filter((t) => t.status === "Completed");
  const impact = useMemo(() => completed.reduce((sum, t) => sum + (t.estimatedImpactKg ?? 0), 0), [completed]);
  const deliveredQuantities = completed.reduce((totals, trip) => totals.set(trip.unit, (totals.get(trip.unit) ?? 0) + trip.quantityValue), new Map<string, number>());
  const quantitySummary = [...deliveredQuantities].map(([unit, quantity]) => `${quantity} ${unit}`).join(" · ") || "No completed quantities yet";

  const runAction = async (id: string, action: "accept" | "reject") => {
    setBusyId(id); setActionError("");
    try {
      if (action === "accept") { await acceptTrip(id); await navigate({ to: "/driver/trip/$id", params: { id } }); }
      else await rejectTrip(id);
    } catch (e) { setActionError(e instanceof Error ? e.message : `Could not ${action} this trip.`); }
    finally { setBusyId(null); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Driver workspace</p><h1 className="mt-1 font-display text-2xl font-bold">Good to see you</h1><p className="mt-1 text-sm text-muted-foreground">Your real assignments and food rescue impact.</p></div><Button variant="outline" onClick={() => void refreshTrips()} disabled={loading}><RotateCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Refresh trips</Button></div>
    {(error || actionError) && <p role="alert" className="surface text-sm text-danger">{actionError || error}</p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4"><Metric label="Available offers" value={String(offers.length)} detail="Confirmed NGO allocations" icon={PackageCheck} /><Metric label="Active delivery" value={active ? "1" : "0"} detail={active?.status ?? "No active trip"} icon={Truck} /><Metric label="Completed trips" value={String(completed.length)} detail="OTP-verified deliveries" icon={MapPin} /><Metric label="Food rescued" value={impact > 0 ? `${impact.toFixed(1)} kg` : `${completed.length} deliveries`} detail={impact > 0 ? "Estimated from completed allocations" : quantitySummary} icon={UtensilsCrossed} /></div>

    {active && <section className="surface-strong space-y-3 border-primary/30 p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">Active delivery</p><h2 className="mt-1 font-display text-lg font-bold">{active.food} · {active.quantity}</h2></div><StatusPill status={active.status} /></div><p className="text-sm">{active.kitchen} <span className="text-muted-foreground">→</span> {active.ngo}</p><p className="text-xs text-muted-foreground"><MapPin className="mr-1 inline size-3.5" />{active.kitchenAddress} <span className="mx-1">→</span>{active.ngoAddress}</p><Link to="/driver/trip/$id" params={{ id: active.id }} className="inline-flex text-sm font-bold text-primary underline">Continue this delivery</Link></section>}

    <section className="space-y-3"><div className="flex items-end justify-between gap-2"><div><h2 className="font-display text-lg font-bold">Available offers</h2><p className="text-xs text-muted-foreground">Confirmed allocations from the Supabase trip feed.</p></div><Link to="/driver/trips" className="text-xs font-semibold text-primary underline">All trips</Link></div>
      {loading && !trips.length ? <p className="surface text-center text-sm text-muted-foreground">Loading real trip offers…</p> : offers.length ? <div className="grid gap-3 lg:grid-cols-2">{offers.slice(0, 4).map((offer) => <article key={offer.id} className="surface space-y-3"><div className="flex items-start justify-between gap-2"><div><h3 className="font-display font-bold">{offer.food}</h3><p className="mt-1 text-sm font-semibold text-primary">{offer.quantity}</p></div><StatusPill status={offer.status} /></div><div className="grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-border p-3"><p className="text-[10px] font-bold uppercase text-primary">Pickup kitchen</p><p className="mt-1 text-sm font-semibold">{offer.kitchen}</p><p className="mt-0.5 text-xs text-muted-foreground">{offer.kitchenAddress}</p></div><div className="rounded-lg border border-border p-3"><p className="text-[10px] font-bold uppercase text-primary">Receiving NGO</p><p className="mt-1 text-sm font-semibold">{offer.ngo}</p><p className="mt-0.5 text-xs text-muted-foreground">{offer.ngoAddress}</p></div></div><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-3.5 text-primary" />Use by {offer.availableUntil}</p><div className="grid grid-cols-2 gap-2"><Button onClick={() => void runAction(offer.id, "accept")} disabled={!!active || busyId !== null}>{busyId === offer.id ? "Accepting…" : "Accept trip"}</Button><Button variant="outline" onClick={() => void runAction(offer.id, "reject")} disabled={busyId !== null}>{busyId === offer.id ? "Updating…" : "Reject"}</Button></div></article>)}</div> : <p className="surface text-center text-sm text-muted-foreground">No available allocations yet. An offer appears after an NGO confirms food through the WhatsApp assistant.</p>}
      {offers.length > 4 && <Link to="/driver/trips" className="block text-center text-xs font-semibold text-primary underline">View {offers.length - 4} more offer(s)</Link>}
    </section>
  </div>;
}
