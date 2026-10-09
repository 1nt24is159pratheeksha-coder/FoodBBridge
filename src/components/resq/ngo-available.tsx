import { useState } from "react";
import { MapPin, Package, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoLabel, StatusBadge } from "./dashboard-content";
import { PriorityBadge, fmt, getPriority } from "./surplus";
import { isAvailableForNgo, respondToOffer, useSharedStore, NGO } from "./surplus-store";

export function NgoAvailableFood() {
  const { surplus, requests, ready } = useSharedStore();
  const available = surplus.filter(isAvailableForNgo);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const rejectedByMe = new Set(requests.filter((r) => r.ngoId === NGO.id && r.status === "Rejected").map((r) => r.surplusId));

  const respond = (id: string, decision: "Accepted" | "Rejected") => {
    respondToOffer(id, decision);
    setNotice(decision === "Accepted" ? { ok: true, text: "Food accepted successfully. The kitchen has been notified." } : { ok: false, text: "Food offer rejected." });
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase text-primary">NGO · {NGO.name}</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Available food</h2><p className="mt-1 text-sm text-muted-foreground">{available.length} surplus offers waiting for your response.</p></div>
      <DemoLabel />
    </div>
    {notice && <div role="status" className={`surface flex items-center gap-3 py-3 ${notice.ok ? "border-success/30" : "border-danger/30"}`}>
      {notice.ok ? <CheckCircle2 className="size-5 text-success" /> : <XCircle className="size-5 text-danger" />}
      <p className="text-sm font-semibold">{notice.text}</p>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setNotice(null)}>Dismiss</Button>
    </div>}
    {ready && available.length === 0 ? <div className="surface flex min-h-48 flex-col items-center justify-center text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-highlight text-primary"><Package className="size-6" /></span>
      <p className="mt-4 text-sm font-semibold">No available surplus food at the moment.</p>
    </div> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{available.map((r) => {
      const rows: [string, string][] = [["Quantity", `${r.quantity} ${r.unit.toLowerCase()}`], ["Estimated weight", `${r.estimatedWeight} kg`], ["Prepared", fmt(r.preparedAt)], ["Usable until", fmt(r.usableUntil)], ["Visual quality", r.qualityStatus], ["Assessment", r.assessment ? `Completed · ${fmt(r.assessment.assessedAt)}` : "Not yet assessed"]];
      return <section key={r.id} className="surface flex flex-col">
        {r.image && <img src={r.image} alt={r.foodName} className="mb-3 h-32 w-full rounded-md object-cover" />}
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate font-display text-base font-bold">{r.foodName}</h3><p className="text-xs font-semibold text-primary">{r.kitchenName}</p></div><PriorityBadge priority={getPriority(r.usableUntil)} /></div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground"><MapPin className="mt-0.5 size-3.5 shrink-0" />{r.pickupLocation}</p>
        <dl className="mt-3 flex-1">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-border/70 py-1.5 text-xs"><dt className="text-muted-foreground">{k}</dt><dd className="font-bold">{v}</dd></div>)}
          <div className="flex items-center justify-between gap-3 py-1.5 text-xs"><dt className="text-muted-foreground">Current status</dt><dd><StatusBadge status={r.currentStatus} /></dd></div></dl>
        {rejectedByMe.has(r.id) && <p className="mt-1 text-[11px] text-muted-foreground">You declined this offer earlier — you can still accept it.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={() => respond(r.id, "Accepted")}><CheckCircle2 className="size-4" /> Accept Food</Button>
          <Button variant="outline" onClick={() => respond(r.id, "Rejected")}><XCircle className="size-4" /> Reject Food</Button>
        </div>
      </section>;
    })}</div>}
  </div>;
}
