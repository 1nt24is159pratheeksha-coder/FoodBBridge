import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DRIVER_PROFILE, tripStore, useTrips } from "@/lib/driver/trips";
import { clearDemoRole } from "@/lib/demo-session";

export const Route = createFileRoute("/driver/profile")({ head: () => ({ meta: [{ title: "Driver Profile | ResQFood AI" }] }), component: Profile });

function Profile() {
  const done = useTrips().filter((t) => t.status === "Completed").length;
  return <div className="space-y-4">
    <section className="surface flex items-center gap-4">
      <span className="flex size-14 items-center justify-center rounded-full bg-highlight text-lg font-bold text-primary">AK</span>
      <div><p className="font-display text-lg font-bold">{DRIVER_PROFILE.name}</p><p className="text-sm text-muted-foreground">{DRIVER_PROFILE.phone}</p><p className="text-xs text-muted-foreground">{DRIVER_PROFILE.vehicle} · {DRIVER_PROFILE.zone}</p></div>
    </section>
    <section className="surface text-sm"><p><span className="font-display text-2xl font-bold">{done}</span> trips completed</p></section>
    <Button variant="outline" className="w-full" onClick={() => tripStore.reset()}><RotateCcw className="size-4" />Reset demo trips</Button>
    <Button variant="outline" className="w-full" asChild><Link to="/login" onClick={() => clearDemoRole()}><LogOut className="size-4" />Logout</Link></Button>
  </div>;
}
