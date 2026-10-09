import { useEffect, useRef, useState } from "react";
import { Bot, Building2, HeartHandshake, Workflow, Play, RotateCcw, ChevronRight, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/** Scripted, clearly simulated conversations. Not connected to Twilio — the live tester below is. */
type Msg = { from: "user" | "bot"; text: string; image?: string };

const kitchenScript: Msg[] = [
  { from: "user", text: "Hi" },
  { from: "bot", text: "Welcome to ResQFood AI, Fresh Bites Cafe (AI verified).\n1. Report surplus food\n2. My donations" },
  { from: "user", text: "1" },
  { from: "bot", text: "Please send a photo of the surplus food." },
  { from: "user", text: "", image: "Vegetarian Rice" },
  { from: "bot", text: "AI food assessment (visual):\n• Food: Vegetarian Rice (94%)\n• Estimated: ~50 portions · ~25 kg\n• Visual screening: no obvious visible issue\n\nThis is visual screening only — not a food-safety guarantee. When was it prepared and how is it stored?" },
  { from: "user", text: "Prepared 1:30 PM, kept hot" },
  { from: "bot", text: "Eligible for redistribution until 6:00 PM (food-safety rules). Finding a nearby verified NGO…" },
  { from: "bot", text: "Feed The City accepted your food.\nDriver Arjun arrives ~4:45 PM.\nPickup OTP: 4821 — share it with the driver." },
];
const ngoScript: Msg[] = [
  { from: "bot", text: "Food available nearby\nVegetarian Rice · 50 portions (~25 kg)\nFresh Bites Cafe, Indiranagar · 2.1 km\nAvailable until 6:00 PM\n\nReply ACCEPT or DECLINE" },
  { from: "user", text: "ACCEPT" },
  { from: "bot", text: "Confirmed. Driver Arjun has been assigned.\nDelivery OTP: 7390 — give it to the driver on arrival." },
  { from: "bot", text: "Arjun picked up the food (pickup OTP verified). ETA 20 min." },
  { from: "bot", text: "Delivered — 50 portions received. Thank you for rescuing food!" },
];
const flowSteps: { title: string; detail: string }[] = [
  { title: "Surplus reported on WhatsApp", detail: "Fresh Bites Cafe sends a photo of Vegetarian Rice." },
  { title: "AI food assessment", detail: "Food identified, ~50 portions / ~25 kg estimated, visual quality screened." },
  { title: "Eligibility rules", detail: "Preparation time + hot holding → redistributable until 6:00 PM." },
  { title: "Matching", detail: "Candidates: AI-verified NGOs nearby with capacity and matching food preferences." },
  { title: "NGO offer sent", detail: "Feed The City (3.4 km, capacity 120 kg) is offered the food." },
  { title: "NGO confirmed", detail: "Feed The City replies ACCEPT." },
  { title: "Driver assigned", detail: "Arjun (online, 2.1 km away) accepts the trip." },
  { title: "Pickup OTP verified", detail: "Kitchen shares 4821; status → In Transit." },
  { title: "Delivery OTP verified", detail: "NGO shares 7390; status → Delivered." },
];

function Phone({ title, subtitle, script }: { title: string; subtitle: string; script: Msg[] }) {
  const [shown, setShown] = useState(1);
  const [auto, setAuto] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [shown]);
  useEffect(() => {
    if (!auto) return;
    if (shown >= script.length) { setAuto(false); return; }
    const t = setTimeout(() => setShown((n) => n + 1), 1100);
    return () => clearTimeout(t);
  }, [auto, shown, script.length]);
  const done = shown >= script.length;
  return <div className="mx-auto w-full max-w-sm">
    <div className="overflow-hidden rounded-[2rem] border-8 border-foreground/85 bg-[#efeae2] shadow-lg">
      <div className="flex items-center gap-2 bg-[#075e54] px-4 py-3 text-white"><span className="flex size-8 items-center justify-center rounded-full bg-white/20"><Bot className="size-4" /></span><div><p className="text-sm font-semibold">{title}</p><p className="text-[11px] opacity-80">{subtitle}</p></div></div>
      <div className="h-[420px] space-y-2 overflow-y-auto p-3" aria-live="polite">
        {script.slice(0, shown).map((m, i) => <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[80%] whitespace-pre-line rounded-lg px-3 py-2 text-[13px] text-neutral-900 shadow-sm ${m.from === "user" ? "bg-[#d9fdd3]" : "bg-white"}`}>
            {m.image && <span className="mb-1 flex h-24 w-40 flex-col items-center justify-center rounded bg-neutral-200 text-xs text-neutral-600"><ImageIcon className="size-5" />{m.image}.jpg</span>}
            {m.text}
          </div>
        </div>)}
        <div ref={end} />
      </div>
    </div>
    <div className="mt-3 flex justify-center gap-2">
      <Button size="sm" onClick={() => setShown((n) => Math.min(n + 1, script.length))} disabled={done}><ChevronRight className="size-4" />Next message</Button>
      <Button size="sm" variant="outline" onClick={() => setAuto(true)} disabled={done || auto}><Play className="size-4" />Play</Button>
      <Button size="sm" variant="ghost" onClick={() => { setAuto(false); setShown(1); }}><RotateCcw className="size-4" />Restart</Button>
    </div>
  </div>;
}

function MatchingFlow() {
  const [at, setAt] = useState(0);
  return <div className="mx-auto max-w-xl">
    <ol className="space-y-2">{flowSteps.map((s, i) => <li key={s.title} className={`surface flex items-start gap-3 py-3 ${i > at ? "opacity-40" : ""}`}>
      {i <= at ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <span className="mt-0.5 size-4 shrink-0 rounded-full border border-border" />}
      <div><p className="text-sm font-semibold">{s.title}</p><p className="text-xs text-muted-foreground">{s.detail}</p></div>
    </li>)}</ol>
    <div className="mt-3 flex justify-center gap-2">
      <Button size="sm" onClick={() => setAt((n) => Math.min(n + 1, flowSteps.length - 1))} disabled={at >= flowSteps.length - 1}><ChevronRight className="size-4" />Next step</Button>
      <Button size="sm" variant="ghost" onClick={() => setAt(0)}><RotateCcw className="size-4" />Restart</Button>
    </div>
  </div>;
}

export function WhatsAppDemo() {
  return <section className="surface">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display font-bold">Conversation demo</h2><span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-[11px] font-bold text-warning">Scripted simulation</span></div>
    <Tabs defaultValue="kitchen">
      <TabsList><TabsTrigger value="kitchen"><Building2 className="size-4" />Kitchen</TabsTrigger><TabsTrigger value="ngo"><HeartHandshake className="size-4" />NGO</TabsTrigger><TabsTrigger value="flow"><Workflow className="size-4" />Matching flow</TabsTrigger></TabsList>
      <TabsContent value="kitchen" className="mt-4"><Phone title="ResQFood AI" subtitle="Kitchen · Fresh Bites Cafe" script={kitchenScript} /></TabsContent>
      <TabsContent value="ngo" className="mt-4"><Phone title="ResQFood AI" subtitle="NGO · Feed The City" script={ngoScript} /></TabsContent>
      <TabsContent value="flow" className="mt-4"><MatchingFlow /></TabsContent>
    </Tabs>
  </section>;
}
