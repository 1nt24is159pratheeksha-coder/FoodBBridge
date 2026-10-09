import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, PageTitle, StatusPill, MockNote } from "@/components/rf/ui";
import { surplus, pipeline, isActiveFlow, type FlowStatus, type Surplus } from "@/components/rf/data";
import { formatDuration, useNow } from "@/lib/use-now";

type Search = { stage?: FlowStatus };

export const Route = createFileRoute("/admin/operations")({
  validateSearch: (s: Record<string, unknown>): Search => {
    const v = s["stage"];
    return pipeline.some((p) => p.status === v) ? { stage: v as FlowStatus } : {};
  },
  head: () => ({ meta: [
    { title: "Operations | ResQFood AI" },
    { name: "description", content: "One live view of surplus, NGO matching, driver assignment and delivery." },
    { property: "og:title", content: "Operations | ResQFood AI" },
    { property: "og:description", content: "The whole redistribution pipeline in one place." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Operations,
});

function TimeLeft({ s, now, start }: { s: Surplus; now: number | null; start: number }) {
  if (s.windowMinutes === null) return <span className="text-muted-foreground">—</span>;
  if (now === null) return <span className="text-muted-foreground">…</span>;
  const left = s.windowMinutes * 60_000 - (now - start);
  return <span className={left < 60 * 60_000 ? "font-semibold text-danger" : ""}>{formatDuration(left)}</span>;
}

function Operations() {
  const { stage } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/operations" });
  const now = useNow();
  const [start] = useState(() => Date.now());
  const count = (st: FlowStatus) => surplus.filter((s) => s.status === st).length;
  const active = surplus.filter((s) => isActiveFlow(s.status)).length;
  const rows = stage ? surplus.filter((s) => s.status === stage) : surplus;
  return <>
    <PageTitle title="Operations" subtitle={`${active} active surplus · every item from capture to delivery in one view.`} actions={<MockNote />} />
    <section aria-label="Operational pipeline" className="surface">
      <div className="flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</h2>{stage && <Button size="sm" variant="ghost" onClick={() => navigate({ search: {} })}>Show all</Button>}</div>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex lg:items-stretch">
        {pipeline.map((p, i) => <li key={p.status} className="flex items-center gap-1 lg:flex-1">
          <button type="button" aria-pressed={stage === p.status} onClick={() => navigate({ search: stage === p.status ? {} : { stage: p.status } })}
            className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${stage === p.status ? "border-primary bg-highlight" : "border-border hover:border-primary/40"}`}>
            <p className="font-display text-2xl font-bold">{count(p.status)}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{p.label}</p>
          </button>
          {i < pipeline.length - 1 && <ChevronRight className="hidden size-4 shrink-0 text-muted-foreground lg:block" />}
        </li>)}
      </ol>
    </section>
    <div className="mt-6 mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live operations{stage ? ` · ${pipeline.find((p) => p.status === stage)?.label}` : ""}</h2><span className="text-xs text-muted-foreground">{rows.length} item(s)</span></div>
    {rows.length === 0 ? <p className="surface text-center text-sm text-muted-foreground">Nothing in this stage right now.</p> :
      <DataTable head={["Food", "Kitchen", "Quantity", "NGO", "Driver", "Status", "Time Remaining", "Action"]} rows={rows.map((s) => [
        <span className="font-medium">{s.food}</span>, s.kitchen, s.quantity, s.ngo ?? "—", s.driver ?? "—", <StatusPill status={s.status} />,
        <TimeLeft s={s} now={now} start={start} />,
        <Button size="sm" variant="outline" asChild><Link to="/admin/surplus/$id" params={{ id: s.id }}>View</Link></Button>,
      ])} />}
  </>;
}
