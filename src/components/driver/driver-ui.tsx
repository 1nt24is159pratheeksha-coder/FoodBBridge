import { useState, type FormEvent } from "react";
import { Check, CheckCircle2, Clock3, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyTripOtp, type Trip, type TripStatus } from "@/lib/driver/trips";

export function TripStepper({ status }: { status: TripStatus }) {
  const stages = ["Accepted", "Pickup OTP verified", "In transit", "Delivery OTP verified", "Completed"];
  const at = status === "Offered" ? -1 : status === "Rejected" || status === "Unavailable" ? -1 : status === "Accepted" || status === "At Pickup" ? 0 : status === "Picked Up" || status === "In Transit" ? 2 : status === "At Delivery" ? 3 : 4;
  const terminal = status === "Completed";
  const current = status === "At Pickup" ? "Enter the kitchen's OTP to confirm collection" : status === "At Delivery" ? "Enter the NGO's OTP to verify delivery" : status === "Picked Up" ? "Pickup confirmed · start the journey when ready" : status === "In Transit" ? "On the way to the receiving NGO" : status === "Completed" ? "Both OTP checks passed · trip complete" : status === "Offered" ? "Accept this offer to begin" : status;
  return <div className="space-y-3"><ol className="flex overflow-x-auto pb-1" aria-label="Delivery milestones">{stages.map((stage, i) => {
    const done = terminal || i < at;
    const active = !terminal && i === at;
    return <li key={stage} className="flex min-w-21 flex-1 flex-col items-center text-center">
      <div className="flex w-full items-center"><span className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : done ? "bg-primary" : "bg-border"}`} /><span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="size-4" /> : i + 1}</span><span className={`h-0.5 flex-1 ${i === stages.length - 1 ? "opacity-0" : done ? "bg-primary" : "bg-border"}`} /></div>
      <span className={`mt-2 max-w-20 text-[10px] leading-tight ${active ? "font-bold text-primary" : done ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{stage}</span>
    </li>;
  })}</ol><p className="rounded-lg bg-highlight px-3 py-2 text-xs font-semibold text-primary" aria-live="polite">{current}</p></div>;
}

export function TripEventFeed({ history }: { history: Trip["history"] }) {
  return <section className="surface space-y-3" aria-labelledby="trip-events-heading">
    <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Saved trip updates</p><h2 id="trip-events-heading" className="mt-1 font-display font-bold">Activity</h2><p className="mt-1 text-xs text-muted-foreground">Status events are stored with this trip. Automatic outbound partner messages are not configured.</p><p className="mt-1 text-xs text-muted-foreground">Google Maps opens driving directions; this app does not share live GPS location.</p></div>
    {history.length ? <ol className="divide-y divide-border">{[...history].reverse().map((event, index) => <li key={`${event.at}-${event.status}`} className="flex items-start gap-3 py-2.5"><span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-highlight text-primary" : "bg-muted text-muted-foreground"}`}>{index === 0 ? <Check className="size-3.5" /> : <Clock3 className="size-3.5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{event.status}</p><time className="text-xs text-muted-foreground" dateTime={event.at}>{new Date(event.at).toLocaleString()}</time></div></li>)}</ol> : <p className="text-sm text-muted-foreground">No saved trip events yet.</p>}
    <p className="rounded-lg bg-muted/60 p-3 text-[11px] text-muted-foreground">The kitchen and NGO can request the latest status in WhatsApp. Configure an outbound WhatsApp sender to deliver automatic messages.</p>
  </section>;
}

export function OtpCheck({ trip, kind }: { trip: Trip; kind: "pickup" | "delivery" }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try { await verifyTripOtp(trip.id, kind, otp); setOtp(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to verify this code. Please try again."); }
    finally { setBusy(false); }
  };
  const who = kind === "pickup" ? `the kitchen (${trip.kitchen})` : `the NGO (${trip.ngo})`;
  return <form onSubmit={submit} className="rounded-xl border border-primary/25 bg-highlight p-4">
    <p className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-primary" />{kind === "pickup" ? "Pickup OTP" : "Delivery OTP"}</p>
    <p className="mt-1 text-xs text-muted-foreground">Ask {who} for their code. The server verifies it before {kind === "pickup" ? "collection is confirmed" : "the delivery is completed"}; codes are never displayed here.</p>
    <div className="mt-3 flex gap-2">
      <Input aria-label={`${kind} OTP`} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }} placeholder="6-digit OTP" className="max-w-36 font-mono tracking-widest" />
      <Button type="submit" disabled={otp.length !== 6 || busy}>{busy ? "Verifying…" : "Verify"}</Button>
    </div>
    {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
  </form>;
}
