import { CheckCircle2, XCircle, FileText, Bot } from "lucide-react";
import { StatusPill } from "./ui";
import type { VerificationRecord } from "@/lib/verification/types";

export const verificationLabel = (r?: VerificationRecord) => (!r ? "Pending" : r.result.decision === "VERIFIED" ? "AI Verified" : "Rejected");

export function VerificationBadge({ record }: { record?: VerificationRecord | undefined }) {
  return <StatusPill status={verificationLabel(record)} />;
}

/** Read-only explanation of an automated decision. There is intentionally no approve/reject control. */
export function VerificationDetails({ record }: { record: VerificationRecord }) {
  const { submission: s, result: r } = record;
  const ok = r.decision === "VERIFIED";
  return <div className="space-y-4">
    <div className={`rounded-lg p-4 ${ok ? "bg-success-soft" : "bg-danger-soft"}`}>
      <p className={`flex items-center gap-2 text-sm font-bold ${ok ? "text-success" : "text-danger"}`}><Bot className="size-4" />{ok ? "AI VERIFIED" : "AI VERIFICATION FAILED"}</p>
      <ul className="mt-3 space-y-1.5">{r.checks.map((c) => <li key={c.id} className="flex items-start gap-2 text-sm">
        {c.passed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
        <span><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>
      </li>)}</ul>
      <div className="mt-3 flex items-center gap-2 text-sm font-semibold">Status: <StatusPill status={ok ? "AI Verified" : "Rejected"} /></div>
    </div>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Organization</dt><dd className="font-medium">{s.orgName}</dd>
      <dt className="text-muted-foreground">Role</dt><dd className="font-medium">{s.role}</dd>
      <dt className="text-muted-foreground">Location</dt><dd className="font-medium">{s.address}, {s.city}</dd>
      <dt className="text-muted-foreground">Decided</dt><dd className="font-medium">{new Date(r.decidedAt).toLocaleString()}</dd>
      <dt className="text-muted-foreground">Engine</dt><dd className="font-medium">{r.engine} · {r.durationMs} ms</dd>
    </dl>
    <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents received</p>
      <ul className="mt-2 space-y-1">{s.documents.map((d, i) => <li key={i} className="flex items-center gap-2 text-sm"><FileText className="size-4 text-muted-foreground" />{d.type}<span className="text-xs text-muted-foreground">· name on doc: {d.extracted.nameOnDocument}</span></li>)}</ul>
    </div>
    <p className="text-xs text-muted-foreground">Prototype: decisions come from deterministic mock rules (OCR placeholder). A real document-verification provider can replace them without changing this screen.</p>
  </div>;
}
