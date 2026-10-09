import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, ImagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DemoLabel, StatusBadge, type Status } from "./dashboard-content";

export const units = ["Meals", "Portions", "Kg", "Litres"] as const;
export const categories = ["Cooked Meal", "Rice", "Curry", "Bakery", "Fruits", "Vegetables", "Other"] as const;
export const storageOptions = ["Hot", "Refrigerated", "Room Temperature", "Frozen"] as const;
export type Priority = "NORMAL" | "HIGH PRIORITY" | "URGENT" | "BLOCKED";

export type SurplusItem = {
  id: string; name: string; quantity: number; unit: string; weightKg: number;
  preparedAt: string; usableUntil: string; category: string; storage: string;
  location: string; notes: string; imageUrl?: string | undefined;
  quality: "Pending assessment" | "Passed" | "Rejected" | "Eligible for review" | "Review required"; status: Status;
};

/** Demo rule: time remaining until usable-until decides rescue priority. */
export function getPriority(usableUntil: string, now = Date.now()): Priority {
  const hours = (new Date(usableUntil).getTime() - now) / 36e5;
  if (hours <= 0) return "BLOCKED";
  if (hours < 1) return "URGENT";
  if (hours <= 2) return "HIGH PRIORITY";
  return "NORMAL";
}

const priorityClass: Record<Priority, string> = {
  NORMAL: "bg-success-soft text-success border-success/15",
  "HIGH PRIORITY": "bg-warning-soft text-warning border-warning/15",
  URGENT: "bg-danger-soft text-danger border-danger/15",
  BLOCKED: "bg-muted text-muted-foreground border-border",
};
export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${priorityClass[priority]}`}>{priority}</Badge>;
}

const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
const offset = (h: number) => toLocalInput(new Date(Date.now() + h * 36e5));
export const fmt = (v: string) => new Date(v).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const initialSurplus = (): SurplusItem[] => [
  { id: "s1", name: "Packed rice meals", quantity: 20, unit: "Meals", weightKg: 7, preparedAt: offset(-3), usableUntil: offset(0.75), category: "Rice", storage: "Hot", location: "Harvest Community Kitchen, 12 MG Road", notes: "", quality: "Passed", status: "Urgent" },
  { id: "s2", name: "Vegetable meal trays", quantity: 24, unit: "Meals", weightKg: 9, preparedAt: offset(-1), usableUntil: offset(1.5), category: "Cooked Meal", storage: "Hot", location: "Harvest Community Kitchen, 12 MG Road", notes: "", quality: "Passed", status: "Pending" },
  { id: "s3", name: "Bread rolls", quantity: 12, unit: "Kg", weightKg: 12, preparedAt: offset(-2), usableUntil: offset(8), category: "Bakery", storage: "Room Temperature", location: "Harvest Community Kitchen, 12 MG Road", notes: "", quality: "Passed", status: "Available" },
  { id: "s4", name: "Paneer curry", quantity: 8, unit: "Litres", weightKg: 8, preparedAt: offset(-9), usableUntil: offset(-0.5), category: "Curry", storage: "Refrigerated", location: "Harvest Community Kitchen, 12 MG Road", notes: "", quality: "Rejected", status: "Urgent" },
];

const selectClass = "h-9 w-full rounded-md border border-input bg-panel/70 px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ id, label, children, className = "" }: { id: string; label: string; children: ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className}`}><Label htmlFor={id} className="text-xs font-semibold">{label}</Label>{children}</div>;
}

export function AddSurplusPage({ onRegister, onViewList }: { onRegister: (item: SurplusItem) => void; onViewList: () => void }) {
  const [registered, setRegistered] = useState<SurplusItem | null>(null);
  const [image, setImage] = useState<string | undefined>();
  const [error, setError] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (new Date(get("usableUntil")) <= new Date(get("preparedAt"))) { setError("Usable-until time must be after preparation time."); return; }
    setError("");
    const priority = getPriority(get("usableUntil"));
    const item: SurplusItem = {
      id: crypto.randomUUID(), name: get("name"), quantity: Number(get("quantity")), unit: get("unit"), weightKg: Number(get("weight")),
      preparedAt: get("preparedAt"), usableUntil: get("usableUntil"), category: get("category"), storage: get("storage"),
      location: get("location"), notes: get("notes"), imageUrl: image, quality: "Pending assessment",
      status: priority === "URGENT" ? "Urgent" : priority === "BLOCKED" ? "Pending" : "Available",
    };
    onRegister(item); setRegistered(item); setImage(undefined);
  };

  if (registered) {
    const p = getPriority(registered.usableUntil);
    const rows: [string, ReactNode][] = [
      ["Food name", registered.name], ["Quantity", `${registered.quantity} ${registered.unit.toLowerCase()}`], ["Estimated weight", `${registered.weightKg} kg`],
      ["Preparation time", fmt(registered.preparedAt)], ["Usable until", fmt(registered.usableUntil)], ["Storage condition", registered.storage],
      ["Assessment status", <StatusBadge key="a" status="Pending" />], ["Current rescue priority", <PriorityBadge key="p" priority={p} />],
    ];
    return <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Surplus registered" subtitle="Your food has been added to the surplus listing." />
      <section className="surface">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-success-soft text-success"><CheckCircle2 className="size-5" /></span><div><p className="font-display text-base font-bold">{registered.name}</p><p className="text-xs text-muted-foreground">Awaiting food assessment · {registered.location}</p></div></div>
        {registered.imageUrl && <img src={registered.imageUrl} alt={registered.name} className="mt-4 h-40 w-full rounded-md object-cover" />}
        <dl className="mt-5 grid gap-x-6 sm:grid-cols-2">{rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-right text-xs font-bold">{v}</dd></div>)}</dl>
        {p === "BLOCKED" && <p className="mt-4 text-xs font-semibold text-danger">This food has passed its usable-until time and cannot be offered for rescue.</p>}
        <div className="mt-5 flex flex-wrap gap-2"><Button onClick={onViewList}>View surplus listing</Button><Button variant="outline" onClick={() => setRegistered(null)}><Plus className="size-4" /> Register another</Button></div>
      </section>
    </div>;
  }

  return <div className="mx-auto max-w-3xl space-y-5">
    <PageHeader title="Add surplus food" subtitle="Register food that is available for redistribution." />
    <form onSubmit={submit} className="surface grid gap-4 sm:grid-cols-2">
      <Field id="name" label="Food name" className="sm:col-span-2"><Input id="name" name="name" required maxLength={80} placeholder="e.g. Vegetable Rice" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="quantity" label="Quantity"><Input id="quantity" name="quantity" type="number" min={1} required placeholder="40" /></Field>
        <Field id="unit" label="Unit"><select id="unit" name="unit" className={selectClass}>{units.map((u) => <option key={u}>{u}</option>)}</select></Field>
      </div>
      <Field id="weight" label="Estimated weight (kg)"><Input id="weight" name="weight" type="number" min={0.1} step={0.1} required placeholder="12" /></Field>
      <Field id="preparedAt" label="Preparation date/time"><Input id="preparedAt" name="preparedAt" type="datetime-local" required defaultValue={offset(-1)} /></Field>
      <Field id="usableUntil" label="Usable until date/time"><Input id="usableUntil" name="usableUntil" type="datetime-local" required defaultValue={offset(3)} /></Field>
      <Field id="category" label="Food category"><select id="category" name="category" className={selectClass}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field id="storage" label="Storage condition"><select id="storage" name="storage" className={selectClass}>{storageOptions.map((s) => <option key={s}>{s}</option>)}</select></Field>
      <Field id="location" label="Pickup location" className="sm:col-span-2"><Input id="location" name="location" required maxLength={120} defaultValue="Harvest Community Kitchen, 12 MG Road, Indiranagar" /></Field>
      <Field id="image" label="Food image" className="sm:col-span-2">
        <label htmlFor="image" className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-primary/30 bg-highlight/50 p-3 text-xs text-muted-foreground hover:bg-highlight">
          {image ? <img src={image} alt="Selected food" className="size-14 rounded object-cover" /> : <span className="flex size-14 items-center justify-center rounded bg-panel text-primary"><ImagePlus className="size-5" /></span>}
          <span>{image ? "Image attached · click to change" : "Upload a photo of the food (kept in this demo session only)"}</span>
        </label>
        <input id="image" type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); } }} />
      </Field>
      <Field id="notes" label="Additional notes" className="sm:col-span-2"><Textarea id="notes" name="notes" maxLength={500} placeholder="Allergens, packaging, pickup instructions…" /></Field>
      {error && <p className="text-xs font-semibold text-danger sm:col-span-2">{error}</p>}
      <div className="flex items-center justify-between gap-3 sm:col-span-2"><p className="text-[11px] text-muted-foreground">Priority is set automatically from the time remaining.</p><Button type="submit" size="lg">Register Surplus</Button></div>
    </form>
  </div>;
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="flex flex-wrap items-end justify-between gap-3">
    <div><p className="text-xs font-bold uppercase text-primary">Kitchen · Harvest Community Kitchen</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>
    <DemoLabel />
  </div>;
}

export function SurplusListing({ items, onAdd }: { items: SurplusItem[]; onAdd: () => void }) {
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold uppercase text-primary">Kitchen · Harvest Community Kitchen</p><h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Current surplus</h2><p className="mt-1 text-sm text-muted-foreground">{items.length} items registered for redistribution.</p></div>
      <div className="flex items-center gap-2"><DemoLabel /><Button onClick={onAdd}><Plus className="size-4" /> Add surplus</Button></div>
    </div>
    <section className="surface overflow-x-auto p-0">
      <table className="w-full min-w-190 text-left text-xs">
        <thead className="border-b border-border text-[11px] uppercase text-muted-foreground"><tr>{["Food", "Quantity", "Prepared", "Usable until", "Quality status", "Rescue priority", "Current status"].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border/70">{items.map((i) => <tr key={i.id}>
          <td className="px-4 py-3"><p className="font-bold">{i.name}</p><p className="text-[11px] text-muted-foreground">{i.category} · {i.storage}</p></td>
          <td className="px-4 py-3 font-semibold">{i.quantity} {i.unit.toLowerCase()}<p className="text-[11px] font-normal text-muted-foreground">{i.weightKg} kg</p></td>
          <td className="px-4 py-3">{fmt(i.preparedAt)}</td>
          <td className="px-4 py-3">{fmt(i.usableUntil)}</td>
          <td className="px-4 py-3"><span className={`font-semibold ${i.quality === "Passed" || i.quality === "Eligible for review" ? "text-success" : i.quality === "Rejected" ? "text-danger" : "text-warning"}`}>{i.quality}</span></td>
          <td className="px-4 py-3"><PriorityBadge priority={getPriority(i.usableUntil)} /></td>
          <td className="px-4 py-3">{getPriority(i.usableUntil) === "BLOCKED" ? <span className="text-[11px] font-semibold text-muted-foreground">Expired</span> : <StatusBadge status={i.status} />}</td>
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
