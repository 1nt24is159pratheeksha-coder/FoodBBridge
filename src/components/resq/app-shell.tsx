import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Menu, X, LogOut, Leaf, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardContent, DemoLabel } from "./dashboard-content";
import { AddSurplusPage, SurplusListing } from "./surplus";
import { addSurplus, toItem, toRecord, useSharedStore } from "./surplus-store";
import { NgoAvailableFood } from "./ngo-available";
import { WhatsAppAssessments } from "./whatsapp-assessments";
import { KitchenNgoRequests, NgoMyRequests, KitchenNotifications, KitchenAlert } from "./request-pages";
import { KitchensPage, NgosPage, DriversPage, RegistrationsPage, ImpactPage, ReportsPage, WhatsAppNote } from "./admin-pages";
import { DeliveriesPage, DriverWorkspace, LiveDeliveryStrip } from "./deliveries";
import { NgoDashboard, AdminDashboard } from "./role-dashboards";
import { navigationByRole, workspaceName, roles, type Role, type Section, isRole } from "./demo-data";

export function AppShell() {
  const search = useSearch({ from: "/dashboard" });
  const initialRole = isRole(search.role) ? search.role : "admin";
  const [role, setRole] = useState<Role>(initialRole);
  const [section, setSection] = useState<Section>("Dashboard");
  const { surplus: records } = useSharedStore();
  const surplus = records.map(toItem);
  const [added, setAdded] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate({ from: "/dashboard" });
  const navigation = navigationByRole[role];
  const workspace = workspaceName[role];
  const switchRole = (next: Role) => { setRole(next); setSection("Dashboard"); navigate({ search: { role: next }, replace: true }); };
  const [logging, setLogging] = useState(false);
  const currentRole = roles.find((item) => item.id === role) ?? roles[0];
  const placeholder = <section className="py-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase text-primary">{currentRole.title} workspace</p><h1 className="mt-2 font-display text-2xl font-bold">{section}</h1></div><DemoLabel /></div><div className="surface flex min-h-60 flex-col items-center justify-center text-center"><span className="flex size-12 items-center justify-center rounded-lg bg-highlight text-primary"><Leaf className="size-6" /></span><h2 className="mt-4 font-display text-base font-bold">{section}</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">This section is ready for the next stage of the demo.</p></div></section>;

  const nav = <>
    <div className={`flex items-center gap-3 px-3 py-5 ${collapsed ? "justify-center" : ""}`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary font-display font-extrabold text-primary-foreground"><Leaf className="size-5" /></span>
      {!collapsed && <div className="min-w-0"><div className="font-display text-lg font-extrabold leading-none">ResQFood <span className="text-primary">AI</span></div><p className="mt-1 text-[10px] font-medium text-muted-foreground">Food rescue workspace</p></div>}
    </div>
    <div className={`mx-2 mb-5 rounded-md border border-primary/10 bg-highlight ${collapsed ? "p-2" : "p-3"}`}>
      {collapsed ? <span className="block text-center text-xs font-extrabold text-primary" title={currentRole.title}>{currentRole.title.slice(0, 1)}</span> : <><p className="text-[10px] font-bold uppercase text-primary">Current workspace</p><p className="mt-1 text-xs font-bold">{currentRole.title} <span className="font-normal text-muted-foreground">/ {currentRole.subtitle}</span></p></>}
    </div>
    {!collapsed && <p className="px-4 pb-2 text-[10px] font-bold uppercase text-muted-foreground">Operations</p>}
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-0.5 px-2">
      {navigation.map(({ label, icon: Icon }) => <Button key={label} variant={section === label ? "navActive" : "nav"} size={collapsed ? "icon" : "default"} title={collapsed ? label : undefined} aria-current={section === label ? "page" : undefined} className={collapsed ? "mx-auto" : "w-full justify-start"} onClick={() => { setSection(label); setMobileOpen(false); }}><Icon className="size-4" />{!collapsed && <span>{label}</span>}</Button>)}
    </nav>
    <div className="m-2 border-t border-border pt-3">
      <Button variant="nav" size={collapsed ? "icon" : "default"} className={collapsed ? "mx-auto" : "w-full justify-start"} title={collapsed ? "Sign out of demo" : undefined} asChild><Link to="/"><LogOut className="size-4" />{!collapsed && "Exit demo"}</Link></Button>
    </div>
  </>;
  return <div className="app-atmosphere min-h-screen text-foreground">
    {mobileOpen && <div className="fixed inset-0 z-30 bg-overlay lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-panel/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-17" : "lg:w-64"}`}>
      <div className="absolute right-2 top-4 lg:hidden"><Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="size-5" /></Button></div>
      {nav}
      <Button variant="ghost" size="icon" title={collapsed ? "Expand navigation" : "Collapse navigation"} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="absolute -right-4 top-7 hidden border border-border bg-panel shadow-sm lg:flex" onClick={() => setCollapsed(!collapsed)}><ChevronDown className={`size-4 transition-transform ${collapsed ? "-rotate-90" : "rotate-90"}`} /></Button>
    </aside>
    <div className={`min-w-0 transition-[margin] duration-200 ${collapsed ? "lg:ml-17" : "lg:ml-64"}`}>
      <header className="sticky top-0 z-20 flex h-17 items-center gap-3 border-b border-border bg-panel/85 px-4 backdrop-blur-xl sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="size-5" /></Button>
        <div className="min-w-0"><p className="truncate font-display text-base font-bold sm:text-lg">{section}</p><p className="hidden text-xs text-muted-foreground sm:block">{workspace.org} · Demo workspace</p></div>
        <div className="ml-auto flex items-center gap-2 sm:gap-3"><span className="hidden sm:inline-flex"><DemoLabel /></span><label className="sr-only" htmlFor="workspace-role">Workspace role</label><select id="workspace-role" value={role} onChange={(event) => switchRole(event.target.value as Role)} className="max-w-28 rounded-md border border-border bg-panel/70 px-2 py-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring sm:max-w-none" aria-label="Workspace role">{roles.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><div className="hidden size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary sm:flex">{workspace.initials}</div></div>
      </header>
      <main className="mx-auto max-w-350 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {role === "driver" && section !== "Notifications" && <KitchenAlert role="driver" onOpen={() => setSection("Notifications")} />}
        {section === "Dashboard" && role === "admin" && <LiveDeliveryStrip onOpen={() => setSection("Deliveries")} />}
        {role === "driver" ? (
          section === "Dashboard" ? <DriverWorkspace view="dashboard" /> : section === "Assigned Deliveries" ? <DriverWorkspace view="assigned" /> : section === "Delivery History" ? <DriverWorkspace view="history" /> : section === "Notifications" ? <KitchenNotifications role="driver" /> : placeholder
        ) : section === "Dashboard" ? <AdminDashboard />
          : section === "Kitchens" ? <KitchensPage /> : section === "NGOs" ? <NgosPage /> : section === "Drivers" ? <DriversPage /> : section === "Registrations" ? <RegistrationsPage />
          : section === "Surplus Food" ? <div className="space-y-4"><WhatsAppNote text="Kitchens will log surplus through the WhatsApp assistant. Until then, admins can log it here on a kitchen's behalf." />{logging ? <AddSurplusPage onRegister={(item) => addSurplus(toRecord(item))} onViewList={() => setLogging(false)} /> : <SurplusListing items={surplus} onAdd={() => setLogging(true)} />}</div>
          : section === "Assessments" ? <WhatsAppAssessments />
          : section === "Allocations" ? <div className="space-y-6"><WhatsAppNote text="NGOs will accept or reject offers on WhatsApp. Use the Accept/Reject buttons below to simulate their reply; accepting creates a delivery for drivers." /><KitchenNgoRequests /><NgoAvailableFood /></div>
          : section === "Deliveries" ? <DeliveriesPage role="admin" /> : section === "Notifications" ? <KitchenNotifications role="all" />
          : section === "Impact" ? <ImpactPage /> : section === "Reports" ? <ReportsPage /> : placeholder}
      </main>
    </div>
  </div>;
}
