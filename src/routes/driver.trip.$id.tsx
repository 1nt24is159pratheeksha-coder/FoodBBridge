import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Flag, Package, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/rf/ui";
import { OtpCheck, TripStepper } from "@/components/driver/driver-ui";
import { acceptTrip, arriveAtDelivery, arriveAtPickup, startTransit, useTrips } from "@/lib/driver/trips";

export const Route = createFileRoute("/driver/trip/$id")({ head: () => ({ meta: [{ title: "Trip | ResQFood AI" }] }), component: TripPage });

function TripPage() {
  const { id } = Route.useParams();
  const trip = useTrips().find((t) => t.id === id);
  if (!trip) return <div className="surface text-center"><p className="font-semibold">Trip not found</p><Link to="/driver/trips" className="mt-2 inline-block text-sm text-primary">Back to trips</Link></div>;
  const s = trip.status;
  return <div className="space-y-4">
    <Link to="/driver/trips" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"><ArrowLeft className="size-4" />Trips</Link>
    <div className="flex items-center justify-between"><h1 className="font-display text-xl font-bold">{trip.id}</h1><StatusPill status={s} /></div>
    <section className="surface space-y-2 text-sm">
      <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 text-primary" /><span><span className="font-semibold">{trip.kitchen}</span><span className="block text-xs text-muted-foreground">Pickup · {trip.kitchenAddress} · {trip.pickupKm} km</span></span></p>
      <p className="flex items-start gap-2"><Flag className="mt-0.5 size-4 text-primary" /><span><span className="font-semibold">{trip.ngo}</span><span className="block text-xs text-muted-foreground">Delivery · {trip.ngoAddress} · {trip.deliveryKm} km</span></span></p>
      <p className="flex items-center gap-2"><Package className="size-4 text-primary" />{trip.quantity} · {trip.food}</p>
      <p className="flex items-center gap-2"><Clock className="size-4 text-warning" />Available until {trip.availableUntil}</p>
    </section>
    {s === "Offered" && <Button className="h-11 w-full" onClick={() => acceptTrip(trip.id)}>Accept Trip</Button>}
    {s === "Accepted" && <Button className="h-11 w-full" onClick={() => arriveAtPickup(trip.id)}>Arrived at pickup</Button>}
    {s === "At Pickup" && <OtpCheck trip={trip} kind="pickup" />}
    {s === "Picked Up" && <Button className="h-11 w-full" onClick={() => startTransit(trip.id)}>Start delivery</Button>}
    {s === "In Transit" && <Button className="h-11 w-full" onClick={() => arriveAtDelivery(trip.id)}>Arrived at NGO</Button>}
    {s === "At Delivery" && <OtpCheck trip={trip} kind="delivery" />}
    {s === "Completed" && <p className="rounded-lg bg-success-soft p-4 text-sm font-semibold text-success">Trip completed · delivery OTP verified. Thank you!</p>}
    <section className="surface"><h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progress</h2><TripStepper status={s} /></section>
  </div>;
}
