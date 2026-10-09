import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, ImagePlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listWhatsAppAssessments, simulateWhatsAppMessage } from "@/lib/assessments.functions";

const qClass: Record<string, string> = {
  ELIGIBLE: "bg-success-soft text-success border-success/15",
  REVIEW_REQUIRED: "bg-warning-soft text-warning border-warning/15",
  URGENT: "bg-danger-soft text-danger border-danger/15",
  REJECTED: "bg-danger-soft text-danger border-danger/15",
};

export function WhatsAppAssessments() {
  const fetchList = useServerFn(listWhatsAppAssessments);
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ["wa-assessments"], queryFn: () => fetchList(), refetchInterval: 10000 });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase text-primary">Admin · WhatsApp</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Food assessments</h2><p className="mt-1 text-sm text-muted-foreground">Kitchens send food photos on WhatsApp. AI visual screening only — not a food-safety guarantee.</p></div>
      <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}><RefreshCw className="size-4" />Refresh</Button>
    </div>
    <section className="surface overflow-x-auto p-0"><table className="w-full min-w-200 text-left text-xs">
      <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{["Kitchen", "Food", "AI Estimated Qty", "Confirmed Qty", "Est. Weight", "Visual Quality", "Confirmation", "Source", "Date/Time"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-border/70">
        {isLoading && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
        {error && <tr><td colSpan={9} className="px-4 py-6 text-center text-danger">Could not load assessments.</td></tr>}
        {data?.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">No WhatsApp assessments yet.</td></tr>}
        {data?.map((r) => <tr key={r.id}>
          <td className="px-4 py-3 font-bold">{r.kitchen}</td><td className="px-4 py-3">{r.food_name}</td>
          <td className="px-4 py-3">{r.ai_estimated_quantity ?? "—"}</td><td className="px-4 py-3">{r.confirmed_quantity ?? "—"}</td>
          <td className="px-4 py-3">{r.ai_estimated_weight ?? "—"} kg</td>
          <td className="px-4 py-3"><Badge variant="outline" className={`rounded-full text-[10px] font-bold ${qClass[r.quality_screening_status] ?? ""}`}>{r.quality_screening_status}</Badge></td>
          <td className="px-4 py-3 capitalize">{r.confirmation_status.replace(/_/g, " ")}</td>
          <td className="px-4 py-3">{r.analysis_mode === "live_ai" ? "AI vision" : <span className="font-bold text-warning">Demo / Simulation</span>}</td>
          <td className="px-4 py-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
        </tr>)}
      </tbody></table></section>
    <Simulator onDone={() => qc.invalidateQueries({ queryKey: ["wa-assessments"] })} />
  </div>;
}

function Simulator({ onDone }: { onDone: () => void }) {
  const send = useServerFn(simulateWhatsAppMessage);
  const [from, setFrom] = useState("+919845011220");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<{ who: "kitchen" | "bot"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!text.trim() && !file) return;
    setBusy(true);
    let image = null;
    if (file) {
      const buf = new Uint8Array(await file.arrayBuffer());
      let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      image = { base64: btoa(s), contentType: file.type || "image/jpeg" };
    }
    setLog((l) => [...l, { who: "kitchen", text: file ? `📷 ${file.name}${text ? " · " + text : ""}` : text }]);
    try { const r = await send({ data: { from, text, image } }); setLog((l) => [...l, { who: "bot", text: r.reply }]); }
    catch (e) { setLog((l) => [...l, { who: "bot", text: "Error: " + (e as Error).message }]); }
    setText(""); setFile(null); setBusy(false); onDone();
  };
  return <section className="surface space-y-3">
    <div className="flex items-center gap-2"><MessageCircle className="size-5 text-success" /><h3 className="font-display text-base font-bold">WhatsApp tester</h3><span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">Demo / Simulation channel</span></div>
    <p className="text-xs text-muted-foreground">Sends a message through the same backend as real WhatsApp (real AI vision for photos), but replies show here instead of on WhatsApp.</p>
    <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border bg-panel/50 p-3">
      {log.length === 0 && <p className="text-xs text-muted-foreground">Demo / Simulation · role is resolved from the phone number on the server. Kitchen: send a food photo. NGO: say "hi".</p>}
      {log.map((m, i) => <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${m.who === "kitchen" ? "ml-auto bg-primary text-primary-foreground" : "bg-highlight"}`}>{m.text}</div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Demo sender" value={from} onChange={(e) => { setFrom(e.target.value); setLog([]); }} className="rounded-md border border-border bg-panel/70 px-2 py-2 text-xs"><option value="+919845011220">Demo kitchen</option><option value="+919900011122">Demo NGO · Sunrise Shelter</option></select>
      <input aria-label="Sender phone" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 rounded-md border border-border bg-panel/70 px-2 py-2 text-xs" />
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-2 text-xs"><ImagePlus className="size-4" />{file ? file.name.slice(0, 14) : "Photo"}<input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <input aria-label="Message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Reply 1, 2, 3 or a quantity" className="min-w-40 flex-1 rounded-md border border-border bg-panel/70 px-2 py-2 text-xs" />
      <Button size="sm" onClick={submit} disabled={busy}><Send className="size-4" />{busy ? "Sending…" : "Send"}</Button>
    </div>
  </section>;
}
