import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  MapPin,
  Flag,
  Package,
  Clock,
  Sparkles,
  CircleCheck,
  Navigation,
  CloudRain,
  Route as RouteIcon,
  ShieldAlert,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/rf/ui";
import {
  OtpCheck,
  TripEventFeed,
  TripStepper,
} from "@/components/driver/driver-ui";
import {
  acceptTrip,
  arriveAtDelivery,
  arriveAtPickup,
  rejectTrip,
  startTransit,
  useTripState,
} from "@/lib/driver/trips";
import { askAgnesAboutTrip } from "@/lib/driver/agnes.functions";

export const Route = createFileRoute("/driver/trip/$id")({
  head: () => ({ meta: [{ title: "Trip | ResQFood AI" }] }),
  component: TripPage,
});

type RouteOption = {
  name: string;
  distance: number;
  minutes: number;
  weatherImpact: number;
  description: string;
};

function TripPage() {
  const { id } = Route.useParams();
  const { trips, loading, error: loadError } = useTripState();

  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [agnesQuestion, setAgnesQuestion] = useState("");
  const [agnesAnswer, setAgnesAnswer] = useState("");
  const [agnesError, setAgnesError] = useState("");
  const [agnesLoading, setAgnesLoading] = useState(false);

  const trip = trips.find((t) => t.id === id);

  if (!trip) {
    return (
      <div className="surface text-center">
        <p className="font-semibold">
          {loading ? "Loading trip…" : loadError ?? "Trip not found"}
        </p>
        <Link
          to="/driver/trips"
          className="mt-2 inline-block text-sm text-primary"
        >
          Back to trips
        </Link>
      </div>
    );
  }

  const s = trip.status;

  const act = async (action: () => Promise<void>) => {
    setActionError("");
    setActionBusy(true);
    try {
      await action();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Trip update failed.",
      );
    } finally {
      setActionBusy(false);
    }
  };

  const askAgnes = async (question: string) => {
    const prompt = question.trim();
    if (!prompt || agnesLoading) return;

    setAgnesQuestion(prompt);
    setAgnesAnswer("");
    setAgnesError("");
    setAgnesLoading(true);

    try {
      const result = await askAgnesAboutTrip({
        data: { question: prompt, tripId: trip.id },
      });
      setAgnesAnswer(result.answer);
    } catch {
      setAgnesError(
        "Agnes AI could not answer right now. Check your connection or try again later.",
      );
    } finally {
      setAgnesLoading(false);
    }
  };

  // DEMO SCENARIOS ONLY: these are not live route-provider results.
  const routeOptions: RouteOption[] = [
    {
      name: "Route A",
      distance: 4.8,
      minutes: 18,
      weatherImpact: 1,
      description: "Shorter distance; moderate weather sensitivity.",
    },
    {
      name: "Route B",
      distance: 5.6,
      minutes: 21,
      weatherImpact: 0.5,
      description: "Longer alternative; lower assumed weather impact.",
    },
    {
      name: "Route C",
      distance: 6.4,
      minutes: 26,
      weatherImpact: 0.3,
      description: "Longest alternative; lower assumed weather impact.",
    },
  ];

  const rankedRoutes = routeOptions
    .map((option) => ({
      ...option,
      score:
        option.minutes * 0.55 +
        option.distance * 2 +
        option.weatherImpact * 8,
    }))
    .sort((a, b) => a.score - b.score);

  const recommendedRoute = rankedRoutes[0];
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    trip.kitchenAddress,
  )}&destination=${encodeURIComponent(
    trip.ngoAddress,
  )}&travelmode=driving`;

  const urgencyText = trip.availableUntil
    ? `Food usable until ${trip.availableUntil}`
    : "Confirm the food's usable-until time";

  return (
    <div className="space-y-4">
      <Link
        to="/driver/trips"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Trips
      </Link>

      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Trip details
          </p>
          <h1 className="mt-1 font-display text-xl font-bold">
            {trip.food}
          </h1>
          <p className="mt-1 text-sm font-semibold text-primary">
            {trip.quantity}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Trip {trip.id}
          </p>
        </div>
        <StatusPill status={s} />
      </div>

      {(actionError || loadError) && (
        <p role="alert" className="surface text-sm text-danger">
          {actionError || loadError}
        </p>
      )}

      <section className="surface space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold">{trip.kitchen}</p>
            <p className="text-xs text-muted-foreground">
              Pickup · {trip.kitchenAddress}
            </p>
            {s !== "Offered" && (
              <p className="text-xs">
                {trip.kitchenContact ?? "Restaurant contact"}
                {trip.kitchenPhone && (
                  <>
                    {" · "}
                    <a
                      className="text-primary underline"
                      href={`tel:${trip.kitchenPhone}`}
                    >
                      {trip.kitchenPhone}
                    </a>
                  </>
                )}
              </p>
            )}
            <a
              className="mt-1 inline-block text-xs font-semibold text-primary underline"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                trip.kitchenAddress,
              )}&travelmode=driving`}
            >
              Navigate to pickup
            </a>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Flag className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-semibold">{trip.ngo}</p>
            <p className="text-xs text-muted-foreground">
              Delivery · {trip.ngoAddress}
            </p>
            {["Picked Up", "In Transit", "At Delivery"].includes(s) && (
              <p className="text-xs">
                {trip.ngoContact ?? "Customer contact"}
                {trip.ngoPhone && (
                  <>
                    {" · "}
                    <a
                      className="text-primary underline"
                      href={`tel:${trip.ngoPhone}`}
                    >
                      {trip.ngoPhone}
                    </a>
                  </>
                )}
              </p>
            )}
            {s !== "Offered" && (
              <a
                className="mt-1 inline-block text-xs font-semibold text-primary underline"
                target="_blank"
                rel="noreferrer"
                href={mapsUrl}
              >
                Navigate to delivery
              </a>
            )}
          </div>
        </div>

        <p className="flex items-center gap-2">
          <Package className="size-4 text-primary" />
          {trip.quantity} · {trip.food}
        </p>
        <p className="flex items-center gap-2">
          <Clock className="size-4 text-warning" />
          Available until {trip.availableUntil}
        </p>
      </section>

      {s === "Offered" && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            className="h-11"
            disabled={actionBusy}
            onClick={() => void act(() => acceptTrip(trip.id))}
          >
            {actionBusy ? "Updating…" : "Accept Trip"}
          </Button>
          <Button
            variant="outline"
            className="h-11"
            disabled={actionBusy}
            onClick={() => void act(() => rejectTrip(trip.id))}
          >
            Reject
          </Button>
        </div>
      )}

      {s === "Accepted" && (
        <Button
          className="h-11 w-full"
          disabled={actionBusy}
          onClick={() => void act(() => arriveAtPickup(trip.id))}
        >
          {actionBusy ? "Updating…" : "Arrived at pickup"}
        </Button>
      )}

      {s === "At Pickup" && <OtpCheck trip={trip} kind="pickup" />}

      {s === "Picked Up" && (
        <Button
          className="h-11 w-full"
          disabled={actionBusy}
          onClick={() => void act(() => startTransit(trip.id))}
        >
          {actionBusy ? "Updating…" : "Start delivery"}
        </Button>
      )}

      {s === "In Transit" && (
        <Button
          className="h-11 w-full"
          disabled={actionBusy}
          onClick={() => void act(() => arriveAtDelivery(trip.id))}
        >
          {actionBusy ? "Updating…" : "Arrived at NGO"}
        </Button>
      )}

      {s === "At Delivery" && <OtpCheck trip={trip} kind="delivery" />}

      {s === "Completed" && (
        <>
          <p className="rounded-lg bg-success-soft p-4 text-sm font-semibold text-success">
            Trip completed · delivery OTP verified. Thank you!
          </p>
          <section className="surface border-success/30 bg-success-soft/50">
            <div className="flex items-center gap-3">
              <CircleCheck className="size-6 text-success" />
              <div>
                <p className="font-display font-bold text-success">
                  Delivery completed
                </p>
                <p className="text-xs text-muted-foreground">
                  The receiving NGO's delivery code was verified.
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-3 border-t border-success/20 pt-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Food delivered
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {trip.quantity} · {trip.food}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Destination
                </dt>
                <dd className="mt-1 text-sm font-semibold">{trip.ngo}</dd>
                <dd className="text-xs text-muted-foreground">
                  {trip.ngoAddress}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Final status
                </dt>
                <dd className="mt-1 text-sm font-semibold text-success">
                  Completed · OTP verified
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {s === "Rejected" && (
        <p className="rounded-lg bg-muted p-4 text-sm font-semibold text-muted-foreground">
          You rejected this request.
        </p>
      )}

      {s === "Unavailable" && (
        <p className="rounded-lg bg-warning-soft p-4 text-sm font-semibold text-warning">
          This request has an unknown status and cannot be updated. Contact
          ResQFood support.
        </p>
      )}

      {(s === "In Transit" || s === "At Delivery") && (
        <section className="surface space-y-4">
          <div className="flex items-center gap-2">
            <RouteIcon className="size-5 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                ResQFood intelligence
              </p>
              <h2 className="font-display text-lg font-bold">
                Smart Route Advisor
              </h2>
            </div>
          </div>

          <div className="rounded-lg border border-warning/30 bg-warning-soft/40 p-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-semibold">
                  Illustrative route comparison
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sample values only. Live traffic, weather and route-provider
                  data are not connected. Confirm current conditions before
                  choosing a route.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-3">
              <CloudRain className="mb-2 size-5 text-primary" />
              <p className="text-sm font-semibold">Weather factor</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Check rain and road conditions before departure.
              </p>
            </div>
            <div className="rounded-lg bg-muted/60 p-3">
              <Timer className="mb-2 size-5 text-primary" />
              <p className="text-sm font-semibold">Food urgency</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {urgencyText}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {rankedRoutes.map((option, index) => (
              <div
                key={option.name}
                className={`rounded-lg border p-3 ${
                  index === 0
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{option.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {index === 0 && (
                    <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                      Best sample score
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Distance
                    </p>
                    <p className="text-sm font-bold">{option.distance} km</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Sample ETA
                    </p>
                    <p className="text-sm font-bold">{option.minutes} min</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Score
                    </p>
                    <p className="text-sm font-bold">
                      {option.score.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Recommendation method: lower sample score is better. The prototype
            weights estimated time, distance and assumed weather impact.
            Replace these sample scenarios with real routing and weather data
            before presenting it as live optimisation.
          </p>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
          >
            <Navigation className="size-4" />
            Open kitchen → NGO directions in Google Maps
          </a>
        </section>
      )}

      <section className="surface space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Delivery journey
          </p>
          <h2 className="mt-1 font-display font-bold">Trip progress</h2>
        </div>
        <TripStepper status={s} />
        {(s === "In Transit" || s === "At Delivery") && (
          <a
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            target="_blank"
            rel="noreferrer"
            href={mapsUrl}
          >
            <Navigation className="size-4" />
            Open kitchen → NGO directions in Google Maps
          </a>
        )}
      </section>

      <TripEventFeed history={trip.history} />

      <section className="surface space-y-3" aria-labelledby="agnes-heading">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 id="agnes-heading" className="font-display font-bold">
            Ask Agnes AI
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Get guidance for this trip. Use the app controls for all trip actions
          and OTP checks.
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            "What should I do next?",
            "What must I verify at pickup?",
          ].map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              disabled={agnesLoading}
              onClick={() => void askAgnes(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void askAgnes(agnesQuestion);
          }}
        >
          <Input
            aria-label="Question for Agnes AI"
            value={agnesQuestion}
            onChange={(e) => setAgnesQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ask about this trip…"
            disabled={agnesLoading}
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            disabled={agnesLoading || !agnesQuestion.trim()}
          >
            {agnesLoading ? "Asking…" : "Ask Agnes"}
          </Button>
        </form>

        {agnesError && (
          <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {agnesError}
          </p>
        )}
        {agnesAnswer && (
          <p
            aria-live="polite"
            className="rounded-lg bg-highlight p-3 text-sm leading-relaxed"
          >
            {agnesAnswer}
          </p>
        )}
      </section>
    </div>
  );
}