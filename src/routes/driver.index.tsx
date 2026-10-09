import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Clock, MapPin, Flag, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { acceptTrip, DRIVER_PROFILE, isActiveTrip, onlineStore, useTrips } from "@/lib/driver/trips";
import { useNow } from "@/lib/use-now";

export const Route = createFileRoute("/driver/")({ component: DriverHome });

const greeting = (now: number | null) => { if (now === null) return "Hello"; const h = new Date(now).getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function DriverHome() {
  const trips = useTrips();
  const online = onlineStore.useStore();
  const now = useNow(60_000);
  const navigate = useNavigate();
  const offer = trips.find((t) => t.status === "Offered");
  const active = trips.find(isActiveTrip);
  const accept = (id: string) => { acceptTrip(id); navigate({ to: "/driver/trip/$id", params: { id } }); };
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div><h1 className="font-display text-2xl font-bold">{greeting(now)}, {DRIVER_PROFILE.firstName}</h1><p className="text-sm text-muted-foreground">{DRIVER_PROFILE.vehicle}</p></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><span className={online ? "text-success" : "text-muted-foreground"}>{online ? "● Online" : "○ Offline"}</span><Switch checked={online} onCheckedChange={(v) => onlineStore.set(v)} aria-label="Online status" /></label>
    </div>
    {active && <Link to="/driver/trip/$id" params={{ id: active.id }} className="surface flex items-center gap-3 border-primary/40">
      <div className="flex-1"><p className="text-xs font-bold uppercase text-primary">Current trip · {active.status}</p><p className="font-semibold">{active.kitchen} → {active.ngo}</p></div><ChevronRight className="size-5 text-muted-foreground" />
    </Link>}
    {!online ? <p className="surface text-center text-sm text-muted-foreground">You're offline. Go online to receive new trips.</p>
      : offer ? <section className="surface-strong space-y-3 p-5" aria-label="New trip">
        <p className="text-xs font-extrabold uppercase tracking-wide text-primary">New trip</p>
        <div className="space-y-2 text-sm">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-primary" /><span><span className="font-semibold">{offer.kitchen}</span><span className="block text-xs text-muted-foreground">Pickup · {offer.kitchenAddress} · {offer.pickupKm} km away</span></span></p>
          <p className="flex items-start gap-2"><Flag className="mt-0.5 size-4 text-primary" /><span><span className="font-semibold">{offer.ngo}</span><span className="block text-xs text-muted-foreground">Delivery · {offer.ngoAddress} · {offer.deliveryKm} km from pickup</span></span></p>
          <p className="flex items-center gap-2"><Package className="size-4 text-primary" />{offer.quantity} · {offer.food}</p>
          <p className="flex items-center gap-2"><Clock className="size-4 text-warning" />Expires {offer.availableUntil}</p>
        </div>
        <Button className="h-11 w-full" onClick={() => accept(offer.id)} disabled={!!active}>Accept Trip</Button>
        {active && <p className="text-center text-xs text-muted-foreground">Finish your current trip first.</p>}
      </section>
      : !active && <p className="surface text-center text-sm text-muted-foreground">No new trips right now. We'll notify you when food is ready for pickup.</p>}
  </div>;
}
