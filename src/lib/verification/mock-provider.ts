import type { CheckResult, DocumentType, OrgRole, RegistrationSubmission, VerificationProvider, VerificationResult } from "./types";

/** Documents each role must provide. Placeholder policy until real rules are configured. */
export const requiredDocuments: Record<OrgRole, DocumentType[]> = {
  Kitchen: ["FSSAI licence", "Address proof"],
  NGO: ["NGO registration certificate", "Address proof"],
};
const supported = new Set<DocumentType>(["FSSAI licence", "Address proof", "NGO registration certificate", "80G / 12A certificate", "GST certificate"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const sameName = (a: string, b: string) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

/** Deterministic rule-based checks standing in for OCR + AI document verification. */
export function evaluateSubmission(sub: RegistrationSubmission, now = new Date()): Omit<VerificationResult, "durationMs" | "decidedAt" | "engine"> {
  const docs = sub.documents;
  const unsupported = docs.filter((d) => !supported.has(d.type));
  const expired = docs.filter((d) => d.extracted.validUntil && new Date(d.extracted.validUntil) < now);
  const nameMismatch = docs.filter((d) => supported.has(d.type) && !sameName(d.extracted.nameOnDocument, sub.orgName));
  const cityMismatch = docs.filter((d) => supported.has(d.type) && norm(d.extracted.city) !== norm(sub.city));
  const missing = requiredDocuments[sub.role].filter((t) => !docs.some((d) => d.type === t));
  const licence = docs.find((d) => d.type === (sub.role === "Kitchen" ? "FSSAI licence" : "NGO registration certificate"));
  const regNo = licence?.extracted.registrationNumber ?? "";
  const eligible = sub.role === "Kitchen" ? /^\d{14}$/.test(regNo) : regNo.trim().length >= 6;

  const checks: CheckResult[] = [
    { id: "extraction", label: "Document details extracted", passed: docs.length > 0, detail: docs.length ? `${docs.length} document(s) read (OCR placeholder)` : "No documents received" },
    { id: "validity", label: "Documents valid & supported", passed: !unsupported.length && !expired.length,
      detail: unsupported.length ? "Invalid/unsupported document" : expired.length ? `Expired: ${expired.map((d) => d.type).join(", ")}` : "All documents supported and in date" },
    { id: "consistency", label: "Identity/details consistent", passed: !nameMismatch.length,
      detail: nameMismatch.length ? `Document/details mismatch: name on ${nameMismatch.map((d) => d.type).join(", ")} differs from "${sub.orgName}"` : "Name matches on all documents" },
    { id: "required", label: "Required documents present", passed: !missing.length, detail: missing.length ? `Required document missing: ${missing.join(", ")}` : `${requiredDocuments[sub.role].join(" + ")} provided` },
    { id: "eligibility", label: "Organization type verified", passed: eligible && !missing.length,
      detail: eligible ? `${sub.role} registration number format valid` : sub.role === "Kitchen" ? "FSSAI number missing or not 14 digits" : "NGO registration number missing or invalid" },
    { id: "location", label: "Location/details consistent", passed: !cityMismatch.length, detail: cityMismatch.length ? `City on documents differs from ${sub.city}` : `All documents match ${sub.city}` },
  ];
  const failed = checks.filter((c) => !c.passed);
  return {
    submissionId: sub.id,
    decision: failed.length ? "REJECTED" : "VERIFIED",
    checks,
    reasons: failed.map((c) => c.detail),
    confidence: failed.length ? 0.97 : 0.94,
  };
}

/** Mock provider: same interface a real service will implement. Resolves almost instantly. */
export const mockVerificationProvider: VerificationProvider = {
  name: "mock-rules-v1",
  async verify(sub) {
    const started = performance.now();
    const r = evaluateSubmission(sub);
    return { ...r, engine: this.name, decidedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - started) };
  },
};
