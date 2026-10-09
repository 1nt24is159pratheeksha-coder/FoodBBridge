import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Camera, ShieldCheck } from "lucide-react";
import { PageTitle, StatusPill, MockNote } from "@/components/rf/ui";
import { surplus } from "@/components/rf/data";

export const Route = createFileRoute("/admin/surplus/$id")({
  loader: ({ params }) => { const item = surplus.find((s) => s.id === params.id); if (!item) throw notFound(); return { item }; },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Surplus not found | ResQFood AI" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.item.id} · ${loaderData.item.food} | ResQFood AI`;
    const d = `Surplus details and food AI assessment for ${loaderData.item.food} from ${loaderData.item.kitchen}.`;
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  notFoundComponent: () => <div className="surface text-center"><p className="font-semibold">Surplus not found.</p><Link to="/admin/operations" className="mt-2 inline-block text-sm text-primary">Back to Operations</Link></div>,
  component: SurplusDetail,
});

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>;
}

function SurplusDetail() {
  const { item: s } = Route.useLoaderData();
  const a = s.ai;
  return <>
    <Link to="/admin/operations" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Operations</Link>
    <PageTitle eyebrow={s.id} title={s.food} subtitle={s.kitchen} actions={<div className="flex items-center gap-2"><MockNote /><StatusPill status={s.status} /></div>} />
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="surface"><h2 className="mb-2 font-display font-bold">Surplus details</h2><dl>
        <Row k="Surplus ID" v={s.id} /><Row k="Kitchen" v={s.kitchen} /><Row k="Food" v={s.food} /><Row k="Quantity" v={s.quantity} />
        <Row k="Approximate Weight" v={`${s.weightKg} kg`} /><Row k="Prepared Time" v={s.preparedAt} /><Row k="Available Until" v={s.availableUntil} />
        <Row k="Storage Condition" v={s.storage} /><Row k="Quality Status" v={s.quality} /><Row k="Location" v={s.location} />
      </dl></section>
      <section className="surface lg:row-span-2">
        <div className="flex items-center justify-between"><h2 className="font-display font-bold">Food AI Assessment</h2>{a ? <StatusPill status={a.eligible ? "Eligible" : "Pending"} /> : <StatusPill status="Pending" />}</div>
        {!a ? <p className="mt-4 rounded-lg bg-muted p-4 text-sm text-muted-foreground">Assessment not available yet. It will appear here once the kitchen's photo has been analysed.</p> : <>
          <h3 className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal"><Camera className="size-3.5" />Computer vision</h3>
          <dl><Row k="Food Detected" v={`${a.food} · ${a.foodConf}%`} /><Row k="Estimated Portions" v={a.portions} /><Row k="Estimated Weight" v={a.weight} /><Row k="Quantity Confidence" v={`${a.qtyConf}%`} /><Row k="Visual Quality" v={`${a.visual} · ${a.visualConf}%`} /></dl>
          <h3 className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><ShieldCheck className="size-3.5" />Safety & rule checks</h3>
          <dl><Row k="Preparation Time" v={s.preparedAt} /><Row k="Storage Condition" v={s.storage} /><Row k="Redistribution Window" v={a.window} /><Row k="Eligibility Status" v={<StatusPill status={a.eligible ? "Eligible" : "Pending"} />} /></dl>
        </>}
        <p className="mt-4 text-xs text-muted-foreground">Computer vision only identifies food, estimates quantity and screens for visible issues. It does not prove food is safe — eligibility comes from preparation time, storage and food-safety rules.</p>
      </section>
      <section className="surface"><h2 className="mb-2 font-display font-bold">Matching & delivery</h2><dl>
        <Row k="Eligibility" v={a ? <StatusPill status={a.eligible ? "Eligible" : "Pending"} /> : "Awaiting assessment"} />
        <Row k="NGO Match" v={s.ngo ?? "Not matched yet"} /><Row k="Driver" v={s.driver ?? "Not assigned"} />
        <Row k="Trip" v={s.deliveryId ?? "—"} /><Row k="Delivery Status" v={<StatusPill status={s.status} />} />
      </dl></section>
    </div>
  </>;
}
