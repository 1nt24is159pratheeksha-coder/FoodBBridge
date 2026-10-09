import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, ListChecks, UserCircle, Leaf } from "lucide-react";

export const Route = createFileRoute("/driver")({
  head: () => ({ meta: [
    { title: "Driver Portal | ResQFood AI" },
    { name: "description", content: "Mobile driver portal for food pickups and OTP-verified deliveries." },
    { property: "og:title", content: "Driver Portal | ResQFood AI" },
    { property: "og:description", content: "Pick up and deliver rescued food." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DriverLayout,
});

const tabs = [
  { to: "/driver", label: "Home", icon: Home, match: (p: string) => p === "/driver" || p === "/driver/" },
  { to: "/driver/trips", label: "Trips", icon: ListChecks, match: (p: string) => p.startsWith("/driver/trip") },
  { to: "/driver/profile", label: "Profile", icon: UserCircle, match: (p: string) => p.startsWith("/driver/profile") },
] as const;

function DriverLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return <div className="min-h-screen bg-background pb-20">
    <header className="sticky top-0 z-20 border-b border-border bg-card"><div className="mx-auto flex h-14 max-w-md items-center gap-2 px-4">
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Leaf className="size-4" /></span>
      <span className="font-display font-extrabold">ResQFood <span className="text-primary">Driver</span></span>
    </div></header>
    <main className="mx-auto max-w-md px-4 py-5"><Outlet /></main>
    <nav aria-label="Driver" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card"><div className="mx-auto grid max-w-md grid-cols-3">
      {tabs.map((t) => { const active = t.match(path); return <Link key={t.to} to={t.to} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}><t.icon className="size-5" />{t.label}</Link>; })}
    </div></nav>
  </div>;
}
