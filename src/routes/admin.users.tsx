import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DataTable, PageTitle, StatusPill, MockNote } from "@/components/rf/ui";
import { VerificationBadge, VerificationDetails } from "@/components/rf/verification-ui";
import { drivers, orgProfiles, surplus, isActiveFlow } from "@/components/rf/data";
import { useVerificationRecords } from "@/lib/verification/store";
import type { VerificationRecord } from "@/lib/verification/types";

const tabs = ["kitchens", "ngos", "drivers"] as const;
type Tab = (typeof tabs)[number];

export const Route = createFileRoute("/admin/users")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } => (tabs.includes(s["tab"] as Tab) ? { tab: s["tab"] as Tab } : {}),
  head: () => ({ meta: [
    { title: "Users | ResQFood AI" },
    { name: "description", content: "Kitchens, NGOs and drivers with their automated AI verification status." },
    { property: "og:title", content: "Users | ResQFood AI" },
    { property: "og:description", content: "Platform participants and AI verification status." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: UsersPage,
});

function UsersPage() {
  const { tab = "kitchens" } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/users" });
  const records = useVerificationRecords();
  const [selected, setSelected] = useState<VerificationRecord | null>(null);
  const [driver, setDriver] = useState<(typeof drivers)[number] | null>(null);
  const byRole = (role: "Kitchen" | "NGO") => records.filter((r) => r.submission.role === role);
  const view = (r: VerificationRecord) => <Button size="sm" variant="outline" onClick={() => setSelected(r)}>View</Button>;
  return <>
    <PageTitle title="Users" subtitle="Registrations are verified automatically by AI — no manual approval queue."
      actions={<><MockNote /><Button size="sm" variant="outline" asChild><Link to="/admin/verification"><BadgeCheck className="size-4" />AI Verification Monitor</Link></Button></>} />
    <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })}>
      <TabsList><TabsTrigger value="kitchens">Kitchens</TabsTrigger><TabsTrigger value="ngos">NGOs</TabsTrigger><TabsTrigger value="drivers">Drivers</TabsTrigger></TabsList>
      <TabsContent value="kitchens" className="mt-4"><DataTable head={["Kitchen", "Type", "Location", "Verification", "Active surplus", ""]} rows={byRole("Kitchen").map((r) => [
        <span className="font-medium">{r.submission.orgName}</span>, orgProfiles[r.submission.orgName]?.type ?? "—", r.submission.address, <VerificationBadge record={r} />,
        String(surplus.filter((s) => s.kitchen === r.submission.orgName && isActiveFlow(s.status)).length), view(r),
      ])} /></TabsContent>
      <TabsContent value="ngos" className="mt-4"><DataTable head={["NGO", "Location", "Accepted food", "Capacity", "Verification", ""]} rows={byRole("NGO").map((r) => {
        const p = orgProfiles[r.submission.orgName];
        return [<span className="font-medium">{r.submission.orgName}</span>, r.submission.address, p?.foods ?? "—", p?.capacityKg ? `${p.capacityKg} kg/day` : "—", <VerificationBadge record={r} />, view(r)];
      })} /></TabsContent>
      <TabsContent value="drivers" className="mt-4"><DataTable head={["Driver", "Vehicle", "Zone", "Status", "Current trip", ""]} rows={drivers.map((d) => [
        <span className="font-medium">{d.name}</span>, d.vehicle, d.zone, <StatusPill status={d.online ? "Active" : "Offline"} />, d.trip,
        <Button size="sm" variant="outline" onClick={() => setDriver(d)}>View</Button>,
      ])} /></TabsContent>
    </Tabs>
    <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">{selected && <><DialogHeader><DialogTitle>{selected.submission.orgName}</DialogTitle><DialogDescription>{selected.submission.role} · automated verification result</DialogDescription></DialogHeader><VerificationDetails record={selected} /></>}</DialogContent>
    </Dialog>
    <Dialog open={!!driver} onOpenChange={(o) => !o && setDriver(null)}>
      <DialogContent>{driver && <><DialogHeader><DialogTitle>{driver.name}</DialogTitle><DialogDescription>Driver profile</DialogDescription></DialogHeader>
        <dl className="grid grid-cols-2 gap-y-2 text-sm"><dt className="text-muted-foreground">Vehicle</dt><dd>{driver.vehicle}</dd><dt className="text-muted-foreground">Phone</dt><dd>{driver.phone}</dd><dt className="text-muted-foreground">Zone</dt><dd>{driver.zone}</dd><dt className="text-muted-foreground">Status</dt><dd><StatusPill status={driver.online ? "Active" : "Offline"} /></dd><dt className="text-muted-foreground">Current trip</dt><dd>{driver.trip}</dd></dl></>}</DialogContent>
    </Dialog>
  </>;
}
