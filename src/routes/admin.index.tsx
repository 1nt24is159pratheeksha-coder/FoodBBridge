import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, Car, Scale, ArrowDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Kpi, PageTitle, StatusPill, MockNote } from "@/components/rf/ui";
import { surplus, drivers } from "@/components/rf/data";
import { useVerificationRecords, verificationStats } from "@/lib/verification/store";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [
    { title: "Admin Overview | ResQFood AI" },
    { name: "description", content: "Live platform overview of kitchens, NGOs, drivers and food redistributed." },
    { property: "og:title", content: "Admin Overview | ResQFood AI" },
    { property: "og:description", content: "Live operations and items needing attention." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Overview,
});

function Overview() {
  const [today, setToday] = useState("");
  useEffect(() => setToday(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })), []);
  const pendingNgo = surplus.filter((s) => s.status === "NGO Confirmation").length;
  const records = useVerificationRecords();
  const verifiedOf = (role: "Kitchen" | "NGO") => records.filter((r) => r.submission.role === role && r.result.decision === "VERIFIED").length;
  const { rejected } = verificationStats(records);
  return <>
    <PageTitle eyebrow="Good Morning, Admin" title="Platform Overview" subtitle={today} actions={<MockNote />} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Active Kitchens" value={String(verifiedOf("Kitchen"))} note="AI verified" icon={Building2} />
      <Kpi label="Verified NGOs" value={String(verifiedOf("NGO"))} note="AI verified" icon={Users} />
      <Kpi label="Active Drivers" value={String(drivers.filter((d) => d.online).length)} icon={Car} />
      <Kpi label="Food Redistributed" value="1,240" unit="kg" icon={Scale} note="All time" />
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live Operations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <OpCard id="SUR-1042" kitchen="Fresh Bites Cafe" food="25 kg Vegetarian Meals" ngo="Feed The City" driver="Arjun" status="In Transit" />
          <OpCard id="SUR-1043" kitchen="Green Kitchen" food="40 kg Cooked Meals" status="NGO Confirmation" label="Awaiting NGO Confirmation" />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attention Required</h2>
        <div className="space-y-2">
          <Attn to="/admin/operations" search={{ stage: "NGO Confirmation" }} text={`${pendingNgo} NGO confirmation pending`} />
          <Attn to="/admin/operations" search={{ stage: "Matching" }} text="1 surplus still matching" />
          <Attn to="/admin/verification" text={`${rejected} registrations auto-rejected by AI`} />
        </div>
      </section>
    </div>
  </>;
}

function OpCard({ id, kitchen, food, ngo, driver, status, label }: { id: string; kitchen: string; food: string; ngo?: string; driver?: string; status: string; label?: string }) {
  return <Link to="/admin/surplus/$id" params={{ id }} className="surface block transition-colors hover:border-primary/40">
    <p className="font-semibold">{kitchen}</p><p className="text-sm text-muted-foreground">{food}</p>
    <ArrowDown className="my-2 size-4 text-muted-foreground" />
    {ngo ? <><p className="font-semibold">{ngo}</p><p className="mt-1 text-sm text-muted-foreground">Driver: {driver}</p></> : <p className="text-sm font-medium">{label}</p>}
    <div className="mt-3"><StatusPill status={status} /></div>
  </Link>;
}

function Attn({ to, search, text }: { to: "/admin/operations" | "/admin/verification"; search?: Record<string, string>; text: string }) {
  return <Link to={to} search={search as never} className="surface flex items-center gap-3 py-3 hover:border-primary/40"><AlertTriangle className="size-4 text-warning" /><span className="flex-1 text-sm font-medium">{text}</span><ChevronRight className="size-4 text-muted-foreground" /></Link>;
}
