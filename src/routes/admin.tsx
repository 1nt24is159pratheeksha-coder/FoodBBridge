import { useEffect, useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Leaf, LayoutDashboard, Workflow, Users, MessageCircle, BarChart3, Settings, LogOut, Menu, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearDemoRole, getDemoRole } from "@/lib/demo-session";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

type To = "/admin" | "/admin/operations" | "/admin/users" | "/admin/whatsapp-demo" | "/admin/impact" | "/admin/settings";
type Item = { label: string; icon: typeof Leaf; to: To; match: (path: string) => boolean };
const items: Item[] = [
  { label: "Overview", icon: LayoutDashboard, to: "/admin", match: (p) => p === "/admin" || p === "/admin/" },
  // Surplus, matches and deliveries live inside Operations (incl. surplus detail pages).
  { label: "Operations", icon: Workflow, to: "/admin/operations", match: (p) => p.startsWith("/admin/operations") || p.startsWith("/admin/surplus") },
  // Automated verification is monitored from Users.
  { label: "Users", icon: Users, to: "/admin/users", match: (p) => p.startsWith("/admin/users") || p.startsWith("/admin/verification") },
  { label: "WhatsApp Demo", icon: MessageCircle, to: "/admin/whatsapp-demo", match: (p) => p.startsWith("/admin/whatsapp-demo") },
  { label: "Impact", icon: BarChart3, to: "/admin/impact", match: (p) => p.startsWith("/admin/impact") },
  { label: "Settings", icon: Settings, to: "/admin/settings", match: (p) => p.startsWith("/admin/settings") },
];
const linkClass = (active: boolean) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-highlight text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  // Demo role routing: a driver session never lands in the admin console.
  useEffect(() => { if (getDemoRole() === "driver") navigate({ to: "/driver", replace: true }); }, [navigate]);

  const nav = <div className="flex h-full flex-col">
    <Link to="/admin" className="flex items-center gap-2 px-5 py-5"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Leaf className="size-4" /></span><span className="font-display text-base font-extrabold">ResQFood <span className="text-primary">AI</span></span></Link>
    <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Admin">
      {items.map((it) => { const active = it.match(path); return <Link key={it.label} to={it.to} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={linkClass(active)}><it.icon className="size-4" />{it.label}</Link>; })}
    </nav>
    <div className="m-3 space-y-1 border-t border-border pt-3">
      <Link to="/admin/profile" onClick={() => setOpen(false)} aria-current={path.startsWith("/admin/profile") ? "page" : undefined} className={linkClass(path.startsWith("/admin/profile"))}><UserCircle className="size-4" />Profile</Link>
      <Link to="/login" onClick={() => clearDemoRole()} className={linkClass(false)}><LogOut className="size-4" />Logout</Link>
    </div>
  </div>;
  return <div className="min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-sidebar lg:block">{nav}</aside>
    {open && <div className="fixed inset-0 z-40 lg:hidden"><div className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-64 bg-sidebar">{nav}</aside></div>}
    <div className="lg:pl-60">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-card px-4 lg:hidden"><Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}><Menu className="size-5" /></Button><span className="font-display font-bold">ResQFood AI</span></header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8"><Outlet /></main>
    </div>
  </div>;
}
