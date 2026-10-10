import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, PackageCheck, RotateCcw, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDriverProfile } from "@/lib/driver/trips.functions";
import { useTripState, refreshTrips } from "@/lib/driver/trips";
import { clearDemoRole } from "@/lib/demo-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/driver/profile")({ head: () => ({ meta: [{ title: "Driver Profile | ResQFood AI" }] }), component: Profile });

function Profile() {
  const { trips } = useTripState();
  const [profile, setProfile] = useState<{ name: string; phone: string | null; vehicle: string | null } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const completed = trips.filter((trip) => trip.status === "Completed");
  const deliveredQuantities = completed.reduce((totals, trip) => totals.set(trip.unit, (totals.get(trip.unit) ?? 0) + trip.quantityValue), new Map<string, number>());
  const quantitySummary = [...deliveredQuantities].map(([unit, quantity]) => `${quantity} ${unit}`).join(" · ") || "No completed quantities yet";
  const estimatedKg = completed.reduce((sum, trip) => sum + (trip.estimatedImpactKg ?? 0), 0);
  useEffect(() => {
    let active = true;
    void getDriverProfile().then((value) => { if (active) setProfile(value); }).catch((e) => { if (active) setError(e instanceof Error ? e.message : "Could not load driver profile."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const logout = async () => { await supabase.auth.signOut(); clearDemoRole(); };
  const initials = profile?.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "DR";
  return <div className="mx-auto max-w-3xl space-y-4">
    <section className="surface flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-highlight text-lg font-bold text-primary">{initials}</span><div className="min-w-0"><p className="font-display text-lg font-bold">{loading ? "Loading profile…" : profile?.name ?? "Driver account"}</p><p className="text-sm text-muted-foreground">{profile?.vehicle || "Vehicle not listed"}{profile?.phone ? ` · ${profile.phone}` : ""}</p></div></section>
    {error && <p role="alert" className="surface text-sm text-danger">{error}</p>}
    <div className="grid gap-3 sm:grid-cols-3"><section className="surface flex items-center gap-3"><PackageCheck className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Completed trips</p><p className="font-display text-xl font-bold">{completed.length}</p></div></section><section className="surface flex items-center gap-3"><UtensilsCrossed className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">Completed quantities</p><p className="font-display text-sm font-bold">{quantitySummary}</p></div></section><section className="surface"><p className="text-xs text-muted-foreground">Estimated food impact</p><p className="font-display text-xl font-bold">{estimatedKg > 0 ? `${estimatedKg.toFixed(1)} kg` : "—"}</p><p className="text-[10px] text-muted-foreground">Based on completed allocation records</p></section></div>
    <Button variant="outline" className="w-full" onClick={() => { void refreshTrips(); }}><RotateCcw className="size-4" />Refresh trips</Button>
    <Button variant="outline" className="w-full" asChild><Link to="/login" onClick={() => void logout()}><LogOut className="size-4" />Logout</Link></Button>
  </div>;
}
