import { useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tripSteps, verifyTripOtp, type Trip, type TripStatus } from "@/lib/driver/trips";

export function TripStepper({ status }: { status: TripStatus }) {
  const at = tripSteps.indexOf(status);
  return <ol className="space-y-2">{tripSteps.map((s, i) => <li key={s} className="flex items-center gap-3 text-sm">
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i < at || status === "Completed" ? "bg-primary text-primary-foreground" : i === at ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>
      {i < at || status === "Completed" ? <CheckCircle2 className="size-3.5" /> : i + 1}</span>
    <span className={i === at ? "font-bold text-primary" : i < at ? "" : "text-muted-foreground"}>{s}</span>
  </li>)}</ol>;
}

export function OtpCheck({ trip, kind }: { trip: Trip; kind: "pickup" | "delivery" }) {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); if (!verifyTripOtp(trip.id, kind, otp)) setError("Incorrect OTP. Please try again."); };
  const who = kind === "pickup" ? `the kitchen (${trip.kitchen})` : `the NGO (${trip.ngo})`;
  return <form onSubmit={submit} className="rounded-lg border border-primary/25 bg-highlight p-4">
    <p className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-primary" />{kind === "pickup" ? "Pickup OTP" : "Delivery OTP"}</p>
    <p className="mt-1 text-xs text-muted-foreground">Ask {who} for their code. Demo OTP: <span className="font-mono font-bold text-foreground">{kind === "pickup" ? trip.pickupOtp : trip.deliveryOtp}</span> · no real SMS is sent</p>
    <div className="mt-3 flex gap-2">
      <Input aria-label={`${kind} OTP`} inputMode="numeric" maxLength={4} value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }} placeholder="4-digit OTP" className="max-w-36 font-mono tracking-widest" />
      <Button type="submit" disabled={otp.length !== 4}>Verify</Button>
    </div>
    {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
  </form>;
}
