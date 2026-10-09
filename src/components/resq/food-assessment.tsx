import { useEffect, useState } from "react";
import { Sparkles, ImagePlus, RefreshCw, ScanSearch, ShieldAlert, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DemoLabel } from "./dashboard-content";
import { PriorityBadge, fmt, getPriority } from "./surplus";
import { saveAssessment, useSharedStore, type Assessment, type ScreeningStatus, type SurplusRecord } from "./surplus-store";

/** Deterministic demo presets by food name. Replace simulateAssessment with a real vision model call later. */
const presets: Record<string, [portions: number, weight: number, qConf: number, vConf: number]> = {
  "vegetable rice": [40, 12, 92, 89],
  "packed rice meals": [20, 7, 90, 87],
  "vegetable meal trays": [24, 9, 88, 91],
  "bread rolls": [60, 12, 86, 93],
  "paneer curry": [32, 8, 84, 78],
};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function simulateAssessment(r: SurplusRecord): Assessment {
  const key = r.foodName.trim().toLowerCase();
  const h = hash(key);
  const [portions, weight, qConf, vConf] = presets[key] ?? [r.quantity, r.estimatedWeight, 82 + (h % 12), 80 + (h % 14)];
  const priority = getPriority(r.usableUntil);
  const screening: ScreeningStatus = priority === "BLOCKED" ? "EXPIRED" : r.qualityStatus === "Rejected" ? "REJECTED" : priority === "URGENT" ? "URGENT" : vConf < 82 ? "REVIEW REQUIRED" : "ELIGIBLE FOR REVIEW";
  const notes = screening === "EXPIRED" ? ["Usable-until time has passed", "Item should not be offered for rescue"]
    : screening === "REJECTED" ? ["Item was previously marked as rejected", "Manual kitchen review needed before any use"]
    : screening === "REVIEW REQUIRED" ? ["Image partly unclear for visual screening", "Please inspect the food manually before offering it"]
    : ["No obvious visible spoilage indicators detected", "Appearance appears consistent with the selected food", "Image quality sufficient for visual screening"];
  return { foodDetected: r.foodName, estimatedPortions: portions, estimatedWeight: weight, screening, qualityNotes: notes, quantityConfidence: qConf, visualConfidence: vConf, assessedAt: new Date().toISOString(), simulated: true };
}

const screeningClass: Record<ScreeningStatus, string> = {
  "ELIGIBLE FOR REVIEW": "bg-success-soft text-success border-success/15",
  "REVIEW REQUIRED": "bg-warning-soft text-warning border-warning/15",
  URGENT: "bg-danger-soft text-danger border-danger/15",
  EXPIRED: "bg-muted text-muted-foreground border-border",
  REJECTED: "bg-danger-soft text-danger border-danger/15",
};
export function ScreeningBadge({ status }: { status: ScreeningStatus }) {
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${screeningClass[status]}`}>{status}</Badge>;
}
function AiTag() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-primary"><Sparkles className="size-3" /> AI estimate · simulated</span>;
}
function Confidence({ label, value }: { label: string; value: number }) {
  return <div><div className="flex justify-between text-[11px] font-semibold"><span className="text-muted-foreground">{label}</span><span>{value}%</span></div>
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-primary/15"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${value}%` }} /></div></div>;
}

type Stage = "idle" | "analyzing" | "result" | "done";

export function FoodAssessmentPage({ onViewInventory }: { onViewInventory: () => void }) {
  const { surplus, ready } = useSharedStore();
  const [selectedId, setSelectedId] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<Assessment | null>(null);
  const [portions, setPortions] = useState("");
  const [weight, setWeight] = useState("");
  const [step, setStep] = useState(0);

  useEffect(() => { if (ready && !selectedId && surplus[0]) setSelectedId(surplus[0].id); }, [ready, surplus, selectedId]);
  const record = surplus.find((r) => r.id === selectedId);

  const reset = (id: string) => { setSelectedId(id); setImage(undefined); setStage("idle"); setResult(null); };
  const onFile = (file?: File) => { if (!file) return; const rd = new FileReader(); rd.onload = () => { setImage(String(rd.result)); setStage("idle"); setResult(null); }; rd.readAsDataURL(file); };

  const analyze = () => {
    if (!record || !image) return;
    setStage("analyzing"); setStep(0);
    const steps = [500, 1000, 1500];
    steps.forEach((t, i) => setTimeout(() => setStep(i + 1), t));
    setTimeout(() => { const a = simulateAssessment(record); setResult(a); setPortions(String(a.estimatedPortions)); setWeight(String(a.estimatedWeight)); setStage("result"); }, 1900);
  };
  const confirm = () => {
    if (!record || !result) return;
    const final: Assessment = { ...result, estimatedPortions: Math.max(1, Number(portions) || result.estimatedPortions), estimatedWeight: Math.max(0.1, Number(weight) || result.estimatedWeight), assessedAt: new Date().toISOString() };
    saveAssessment(record.id, final, image); setResult(final); setStage("done");
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase text-primary">Kitchen · Harvest Community Kitchen</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Food assessment</h2><p className="mt-1 text-sm text-muted-foreground">Photo-based quantity estimate and visual quality screening.</p></div>
      <DemoLabel />
    </div>

    <div className="grid gap-4 xl:grid-cols-5">
      {/* Left: selection + photo */}
      <section className="surface space-y-4 xl:col-span-2">
        <div className="space-y-1.5">
          <Label htmlFor="assess-select" className="text-xs font-semibold">Select surplus food</Label>
          <select id="assess-select" value={selectedId} onChange={(e) => reset(e.target.value)} className="h-10 w-full rounded-md border border-input bg-panel/70 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring">
            {surplus.map((r) => <option key={r.id} value={r.id}>{r.foodName}{r.assessment ? " · assessed" : ""}</option>)}
          </select>
        </div>
        {record && <dl className="grid grid-cols-2 gap-2 text-xs">
          {([["Food name", record.foodName], ["Existing quantity", `${record.quantity} ${record.unit.toLowerCase()}`], ["Estimated weight", `${record.estimatedWeight} kg`], ["Storage", record.storageCondition], ["Prepared", fmt(record.preparedAt)], ["Usable until", fmt(record.usableUntil)]] as const).map(([k, v]) =>
            <div key={k} className="rounded-md border border-border/70 bg-panel/50 p-2.5"><dt className="text-[10px] font-bold uppercase text-muted-foreground">{k}</dt><dd className="mt-1 font-bold">{v}</dd></div>)}
          <div className="col-span-2 flex items-center justify-between rounded-md border border-border/70 bg-panel/50 p-2.5"><dt className="text-[10px] font-bold uppercase text-muted-foreground">Rescue priority</dt><dd><PriorityBadge priority={getPriority(record.usableUntil)} /></dd></div>
        </dl>}

        <div>
          <label htmlFor="assess-photo" className={`relative flex min-h-56 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition-colors ${image ? "border-primary/40" : "border-primary/30 bg-highlight/50 hover:bg-highlight"}`}>
            {image ? <>
              <img src={image} alt="Food to assess" className="absolute inset-0 size-full object-cover" />
              {stage === "analyzing" && <div className="absolute inset-0 bg-primary/10"><div className="scan-line absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-primary/40 to-transparent" /></div>}
            </> : <>
              <span className="flex size-14 items-center justify-center rounded-full bg-panel text-primary shadow-sm"><ImagePlus className="size-6" /></span>
              <p className="mt-3 font-display text-base font-bold">Upload Food Photo</p>
              <p className="mt-1 px-6 text-[11px] text-muted-foreground">Take or choose a clear photo of the whole batch</p>
            </>}
          </label>
          <input id="assess-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="mt-3 flex gap-2">
            {image && <Button variant="outline" asChild><label htmlFor="assess-photo" className="cursor-pointer"><RefreshCw className="size-4" /> Replace image</label></Button>}
            <Button className="flex-1" size="lg" disabled={!image || !record || stage === "analyzing"} onClick={analyze}><ScanSearch className="size-4" /> {stage === "analyzing" ? "Analyzing…" : "Analyze Food"}</Button>
          </div>
        </div>
      </section>

      {/* Right: results */}
      <div className="space-y-4 xl:col-span-3">
        {stage === "idle" && <section className="surface flex min-h-80 flex-col items-center justify-center text-center">
          <span className="flex size-14 items-center justify-center rounded-lg bg-highlight text-primary"><Sparkles className="size-6" /></span>
          <h3 className="mt-4 font-display text-base font-bold">Ready to assess</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">Upload a food photo and click Analyze Food to get a simulated quantity estimate and visual quality screening.</p>
        </section>}

        {stage === "analyzing" && <section className="surface min-h-80 space-y-4">
          <div className="flex items-center gap-3"><span className="flex size-10 animate-pulse items-center justify-center rounded-lg bg-highlight text-primary"><Sparkles className="size-5" /></span><div><p className="font-display text-base font-bold">Analyzing photo…</p><p className="text-xs text-muted-foreground">Simulated AI assessment for the demo</p></div></div>
          {["Detecting food type", "Estimating portions and weight", "Screening visible quality indicators"].map((s, i) => <div key={s} className="flex items-center gap-3 text-sm">
            {step > i ? <CheckCircle2 className="size-4 text-success" /> : <span className="size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />}
            <span className={step > i ? "font-semibold" : "text-muted-foreground"}>{s}</span></div>)}
        </section>}

        {result && (stage === "result" || stage === "done") && stage !== "done" && <>
          <section className="surface">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-display text-base font-bold">Quantity assessment</h3><AiTag /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-highlight p-3"><p className="text-[10px] font-bold uppercase text-primary">Food detected</p><p className="mt-1 font-display text-lg font-extrabold">{result.foodDetected}</p></div>
              <div className="rounded-lg border border-border bg-panel/60 p-3"><Label htmlFor="ai-portions" className="text-[10px] font-bold uppercase text-muted-foreground">Estimated portions</Label><div className="mt-1 flex items-center gap-2"><Input id="ai-portions" type="number" min={1} value={portions} onChange={(e) => setPortions(e.target.value)} className="h-9 font-display text-lg font-extrabold" /><span className="text-xs text-muted-foreground">{record?.unit.toLowerCase()}</span></div></div>
              <div className="rounded-lg border border-border bg-panel/60 p-3"><Label htmlFor="ai-weight" className="text-[10px] font-bold uppercase text-muted-foreground">Estimated weight</Label><div className="mt-1 flex items-center gap-2"><Input id="ai-weight" type="number" min={0.1} step={0.1} value={weight} onChange={(e) => setWeight(e.target.value)} className="h-9 font-display text-lg font-extrabold" /><span className="text-xs text-muted-foreground">kg</span></div></div>
            </div>
            <div className="mt-4"><Confidence label="AI confidence (simulated)" value={result.quantityConfidence} /></div>
            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />Quantity and weight are estimates. Confirm or correct the values before registering the assessment.</p>
          </section>
          <section className="surface">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-display text-base font-bold"><Eye className="size-4 text-primary" /> Visual Quality Screening</h3><ScreeningBadge status={result.screening} /></div>
            <ul className="mt-4 space-y-2">{result.qualityNotes.map((n) => <li key={n} className="flex items-start gap-2 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />{n}</li>)}</ul>
            <div className="mt-4"><Confidence label="Visual screening confidence (simulated)" value={result.visualConfidence} /></div>
            <p className="mt-4 flex items-start gap-2 rounded-md border border-warning/20 bg-warning-soft p-3 text-[11px] font-semibold text-warning"><ShieldAlert className="mt-0.5 size-4 shrink-0" />AI visual screening is not a food-safety guarantee. Final acceptance should follow the kitchen's food-safety procedures.</p>
          </section>
          <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={analyze}><RefreshCw className="size-4" /> Re-analyze</Button><Button size="lg" onClick={confirm}><CheckCircle2 className="size-4" /> Confirm Assessment</Button></div>
        </>}

        {result && stage === "done" && record && <section className="surface">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success"><CheckCircle2 className="size-5" /></span><div><p className="font-display text-base font-bold">Assessment Complete</p><p className="text-xs text-muted-foreground">Saved to the surplus record</p></div></div><Badge variant="outline" className="rounded-full border-success/15 bg-success-soft px-2.5 py-0.5 text-[11px] font-bold text-success">Assessment Complete</Badge></div>
          {image && <img src={image} alt={record.foodName} className="mt-4 h-40 w-full rounded-md object-cover" />}
          <dl className="mt-4 grid gap-x-6 sm:grid-cols-2">{([
            ["Food", record.foodName], ["Quantity", `${result.estimatedPortions} ${record.unit.toLowerCase()}`], ["Estimated weight", `${result.estimatedWeight} kg`],
            ["Prepared", fmt(record.preparedAt)], ["Usable until", fmt(record.usableUntil)], ["Storage condition", record.storageCondition],
            ["Quantity assessment", `${result.quantityConfidence}% confidence · confirmed by kitchen`], ["Assessment timestamp", fmt(result.assessedAt)],
          ] as const).map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-right text-xs font-bold">{v}</dd></div>)}
            <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5"><dt className="text-xs text-muted-foreground">Visual quality screening</dt><dd><ScreeningBadge status={result.screening} /></dd></div></dl>
          <div className="mt-5 flex flex-wrap gap-2"><Button onClick={onViewInventory}>View food inventory</Button><Button variant="outline" onClick={() => reset(record.id)}>Assess again</Button></div>
        </section>}
      </div>
    </div>
  </div>;
}
