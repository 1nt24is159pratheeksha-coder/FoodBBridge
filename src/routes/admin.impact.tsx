import { createFileRoute } from "@tanstack/react-router";
import { Scale, Utensils, CheckCircle2, Leaf } from "lucide-react";
import { Kpi, PageTitle, MockNote } from "@/components/rf/ui";
import { impactWeekly, CO2E_PER_KG } from "@/components/rf/data";

export const Route = createFileRoute("/admin/impact")({
  head: () => ({ meta: [
    { title: "Impact | ResQFood AI" },
    { name: "description", content: "Food redistributed, meals delivered and estimated CO2e impact." },
    { property: "og:title", content: "Impact | ResQFood AI" },
    { property: "og:description", content: "Measured impact of food rescued through ResQFood AI." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Impact,
});

function Impact() {
  const total = 1240; const max = Math.max(...impactWeekly.map((d) => d.kg));
  return <>
    <PageTitle title="Impact" subtitle="What the platform has redistributed so far." actions={<MockNote />} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi label="Food Redistributed" value={total.toLocaleString()} unit="kg" icon={Scale} />
      <Kpi label="Meals Delivered" value="3,100" icon={Utensils} note="≈ 0.4 kg per meal" />
      <Kpi label="Successful Deliveries" value="186" icon={CheckCircle2} />
      <Kpi label="Estimated CO₂e Impact" value={(total * CO2E_PER_KG / 1000).toFixed(1)} unit="t" icon={Leaf} note={`Illustrative ${CO2E_PER_KG} kg CO₂e per kg`} />
    </div>
    <section className="surface mt-6">
      <h2 className="font-display font-bold">Food redistributed — last 7 days</h2>
      <div className="mt-6 flex h-48 items-end gap-3">
        {impactWeekly.map((d) => <div key={d.day} className="flex flex-1 flex-col items-center gap-2"><span className="text-xs font-semibold">{d.kg}</span><div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(d.kg / max) * 140}px` }} /><span className="text-xs text-muted-foreground">{d.day}</span></div>)}
      </div>
    </section>
  </>;
}
