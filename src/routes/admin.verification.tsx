import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, CheckCircle2, Loader2, Upload, ShieldCheck, ShieldX, Percent, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Kpi, PageTitle, MockNote } from "@/components/rf/ui";
import { VerificationBadge, VerificationDetails } from "@/components/rf/verification-ui";
import { submitRegistration, useVerificationRecords, verificationStats } from "@/lib/verification/store";
import type { DocumentType, OrgRole, RegistrationSubmission, VerificationRecord, VerificationResult } from "@/lib/verification/types";
import { timeAgo, useNow } from "@/lib/use-now";

export const Route = createFileRoute("/admin/verification")({
  head: () => ({ meta: [
    { title: "AI Verification Monitor | ResQFood AI" },
    { name: "description", content: "Monitor automated AI verification of kitchen and NGO registrations." },
    { property: "og:title", content: "AI Verification Monitor | ResQFood AI" },
    { property: "og:description", content: "Automated registration verification decisions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VerificationMonitor,
});

const scenarios = {
  valid: "Valid documents",
  missing: "Required document missing",
  mismatch: "Name on document doesn't match",
  unsupported: "Unsupported document uploaded",
} as const;
type Scenario = keyof typeof scenarios;

function buildSubmission(name: string, role: OrgRole, city: string, scenario: Scenario): RegistrationSubmission {
  const licence: DocumentType = role === "Kitchen" ? "FSSAI licence" : "NGO registration certificate";
  const reg = role === "Kitchen" ? "11224999000555" : "KA/BLR/2024/0101";
  let docs: [DocumentType, string, string?][] = [[licence, name, reg], ["Address proof", name]];
  if (scenario === "missing") docs = [["Address proof", name]];
  if (scenario === "mismatch") docs = [[licence, "Different Name Pvt Ltd", reg], ["Address proof", name]];
  if (scenario === "unsupported") docs = [[licence, name, reg], ["Unsupported document", name]];
  return {
    id: `V-${Date.now().toString().slice(-6)}`, orgName: name, role, city, address: city, contactPhone: "+91 90000 00000", submittedAt: new Date().toISOString(),
    documents: docs.map(([type, n, r]) => ({ type, fileName: `${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`, extracted: { nameOnDocument: n, city, ...(r ? { registrationNumber: r } : {}) } })),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Phase = "idle" | "submitting" | "analysing" | "done";

function SimulateRegistration() {
  const [name, setName] = useState("Fresh Bites Cafe Manipal");
  const [role, setRole] = useState<OrgRole>("Kitchen");
  const [city, setCity] = useState("Manipal");
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ submission: RegistrationSubmission; result: VerificationResult } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null); setPhase("submitting");
    const submission = buildSubmission(name.trim() || "New Organization", role, city.trim() || "Bengaluru", scenario);
    await sleep(250); setPhase("analysing"); await sleep(350);
    const r = await submitRegistration(submission);
    setResult({ submission, result: r }); setPhase("done");
  };
  const busy = phase === "submitting" || phase === "analysing";
  const select = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <section className="surface">
    <h2 className="flex items-center gap-2 font-display font-bold"><Upload className="size-4 text-primary" />Simulate a registration</h2>
    <p className="mt-1 text-xs text-muted-foreground">Submits a demo registration to the automated verifier. The decision is made by the system — the admin only monitors.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="space-y-1"><Label htmlFor="v-name">Organization name</Label><Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="v-city">City</Label><Input id="v-city" value={city} onChange={(e) => setCity(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="v-role">Role</Label><select id="v-role" className={select} value={role} onChange={(e) => setRole(e.target.value as OrgRole)}><option>Kitchen</option><option>NGO</option></select></div>
      <div className="space-y-1"><Label htmlFor="v-scn">Documents (demo scenario)</Label><select id="v-scn" className={select} value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)}>{Object.entries(scenarios).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}Submit registration</Button></div>
    </form>
    {phase !== "idle" && <ol className="mt-4 space-y-1 text-sm" aria-live="polite">
      <Step on={phase === "submitting"} done={phase !== "submitting"}>Submitting documents…</Step>
      {phase !== "submitting" && <Step on={phase === "analysing"} done={phase === "done"}>AI analysing…</Step>}
      {result && <li className={`font-semibold ${result.result.decision === "VERIFIED" ? "text-success" : "text-danger"}`}>{result.result.decision === "VERIFIED" ? "Verified ✓" : "Rejected ✗"} <span className="font-normal text-muted-foreground">· decided automatically</span></li>}
    </ol>}
    {result && <div className="mt-4"><VerificationDetails record={result} /></div>}
  </section>;
}
function Step({ on, done, children }: { on: boolean; done: boolean; children: string }) {
  return <li className="flex items-center gap-2 text-muted-foreground">{on ? <Loader2 className="size-4 animate-spin text-primary" /> : done ? <CheckCircle2 className="size-4 text-success" /> : null}{children}</li>;
}

function VerificationMonitor() {
  const records = useVerificationRecords();
  const now = useNow(5_000);
  const [selected, setSelected] = useState<VerificationRecord | null>(null);
  const stats = verificationStats(records);
  const recent = [...records].sort((a, b) => b.result.decidedAt.localeCompare(a.result.decidedAt));
  return <>
    <Link to="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Users</Link>
    <PageTitle title="AI Verification Monitor" subtitle="Kitchen and NGO registrations are verified automatically. Admins monitor decisions; there is no manual approval step." actions={<MockNote>Mock rules · OCR placeholder</MockNote>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Total Verified" value={String(stats.verified)} icon={ShieldCheck} />
      <Kpi label="Verification Failed" value={String(stats.rejected)} icon={ShieldX} />
      <Kpi label="Verification Rate" value={`${stats.rate}%`} icon={Percent} />
      <Kpi label="Decisions" value={String(stats.total)} icon={Activity} note="All automated" />
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
      <section aria-label="Recent automated decisions">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent automated decisions</h2>
        <ul className="space-y-2">{recent.map((r) => <li key={r.submission.id} className="surface flex flex-wrap items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{r.submission.orgName} <span className="text-xs font-normal text-muted-foreground">· {r.submission.role}</span></p>
            <p className="text-xs text-muted-foreground">{r.result.decision === "VERIFIED" ? "AI verified · all checks passed" : r.result.reasons[0]}{now !== null && ` · ${timeAgo(r.result.decidedAt, now)}`}</p>
          </div>
          <VerificationBadge record={r} />
          <Button size="sm" variant="outline" onClick={() => setSelected(r)}>View details</Button>
        </li>)}</ul>
      </section>
      <div><SimulateRegistration /></div>
    </div>
    <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">{selected && <><DialogHeader><DialogTitle>{selected.submission.orgName}</DialogTitle><DialogDescription>{selected.submission.role} · {selected.submission.id}</DialogDescription></DialogHeader><VerificationDetails record={selected} /></>}</DialogContent>
    </Dialog>
  </>;
}
