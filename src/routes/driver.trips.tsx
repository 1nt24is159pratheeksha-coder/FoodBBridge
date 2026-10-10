
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  Package2,
  RotateCw,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/rf/ui";
import {
  refreshTrips,
  type Trip,
  useTripState,
} from "@/lib/driver/trips";

export const Route = createFileRoute("/driver/trips")({
  head: () => ({
    meta: [{ title: "My Trips | ResQFood AI" }],
  }),
  component: Trips,
});

const groups = ["Available", "Ongoing", "Completed"] as const;
type Group = (typeof groups)[number];

function groupOf(trip: Trip): Group | "Other" {
  if (trip.status === "Offered") return "Available";
  if (trip.status === "Completed") return "Completed";
  if (trip.status === "Rejected" || trip.status === "Unavailable") {
    return "Other";
  }
  return "Ongoing";
}

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link
      to="/driver/trip/$id"
      params={{ id: trip.id }}
      className="surface block w-full min-w-0 space-y-4 transition hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-highlight text-primary">
          <Package2 className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-bold">
              {trip.food}
            </h2>
            <StatusPill status={trip.status} />
          </div>

          <p className="mt-1 text-sm font-semibold text-primary">
            {trip.quantity}
          </p>

          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            Trip {trip.id}
          </p>
        </div>

        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-2">
        <Stop
          icon={<MapPin className="size-4" />}
          label="Pickup kitchen"
          name={trip.kitchen}
          address={trip.kitchenAddress}
        />

        <Stop
          icon={<MapPin className="size-4" />}
          label="Receiving NGO"
          name={trip.ngo}
          address={trip.ngoAddress}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-primary" />
          Use by {trip.availableUntil}
        </span>

        {trip.status === "In Transit" ||
        trip.status === "At Delivery" ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Truck className="size-3.5" />
            Delivery underway
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function Stop({
  icon,
  label,
  name,
  address,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  address: string;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-panel/60 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        {icon}
        {label}
      </p>

      <p className="mt-1.5 break-words text-sm font-semibold">{name}</p>

      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
        {address}
      </p>
    </div>
  );
}

function Trips() {
  const { trips, loading, error } = useTripState();
  const [selected, setSelected] = useState<Group>("Available");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group,
          trips.filter((trip) => groupOf(trip) === group).length,
        ]),
      ) as Record<Group, number>,
    [trips],
  );

  const visible = trips.filter((trip) => groupOf(trip) === selected);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Driver workspace
          </p>

          <h1 className="mt-1 font-display text-2xl font-bold">
            My trips
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Real assignments and verified delivery progress.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshTrips()}
          disabled={loading}
          aria-label="Refresh trips"
        >
          <RotateCw
            className={`size-4 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {error && (
        <p role="alert" className="surface text-sm text-danger">
          {error}
        </p>
      )}

      <div
        role="tablist"
        aria-label="Trip status"
        className="grid grid-cols-3 rounded-xl border border-border bg-card p-1"
      >
        {groups.map((group) => (
          <button
            key={group}
            type="button"
            role="tab"
            aria-selected={selected === group}
            onClick={() => setSelected(group)}
            className={`rounded-lg px-2 py-2.5 text-xs font-bold transition ${
              selected === group
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-highlight"
            }`}
          >
            {group}

            <span
              className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                selected === group ? "bg-white/20" : "bg-muted"
              }`}
            >
              {counts[group]}
            </span>
          </button>
        ))}
      </div>

      {loading && !trips.length ? (
        <p className="surface text-center text-sm text-muted-foreground">
          Loading your tripsâ€¦
        </p>
      ) : visible.length ? (
        <ul className="space-y-3">
          {visible.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={trip} />
            </li>
          ))}
        </ul>
      ) : (
        <section className="surface flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-highlight text-primary">
            <Check className="size-6" />
          </span>

          <div>
            <p className="font-semibold">
              {selected === "Available"
                ? "No available trips right now"
                : selected === "Completed"
                  ? "No completed trips yet"
                  : "No ongoing trip"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              {selected === "Available"
                ? "New offers appear after an NGO confirms a food allocation."
                : selected === "Ongoing"
                  ? "Accept an available offer to begin a delivery."
                  : "Your OTP-verified deliveries will appear here."}
            </p>
          </div>
        </section>
      )}

      {trips.some((trip) => groupOf(trip) === "Other") && (
        <details className="surface">
          <summary className="cursor-pointer text-sm font-semibold">
            Unavailable or declined offers
          </summary>

          <ul className="mt-3 space-y-2">
            {trips
              .filter((trip) => groupOf(trip) === "Other")
              .map((trip) => (
                <li key={trip.id}>
                  <TripCard trip={trip} />
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

