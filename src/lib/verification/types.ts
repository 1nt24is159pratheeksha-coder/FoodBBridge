/**
 * Automated organization verification. Kitchens and NGOs are verified by a
 * provider, never by manual admin approval. Today the provider is a deterministic
 * mock (mock-provider.ts); a real OCR / document-verification service can
 * implement the same VerificationProvider interface later.
 */
export type OrgRole = "Kitchen" | "NGO";

export const documentTypes = [
  "FSSAI licence",
  "Address proof",
  "NGO registration certificate",
  "80G / 12A certificate",
  "GST certificate",
  "Unsupported document",
] as const;
export type DocumentType = (typeof documentTypes)[number];

export interface SubmittedDocument {
  type: DocumentType;
  fileName: string;
  /** Fields a real OCR step would extract. In the prototype they are supplied with the submission. */
  extracted: { nameOnDocument: string; city: string; registrationNumber?: string; validUntil?: string };
}

export interface RegistrationSubmission {
  id: string;
  orgName: string;
  role: OrgRole;
  city: string;
  address: string;
  contactPhone: string;
  documents: SubmittedDocument[];
  submittedAt: string;
}

export type CheckId = "extraction" | "validity" | "consistency" | "required" | "eligibility" | "location";
export interface CheckResult { id: CheckId; label: string; passed: boolean; detail: string }

export type VerificationDecision = "VERIFIED" | "REJECTED";
export interface VerificationResult {
  submissionId: string;
  decision: VerificationDecision;
  checks: CheckResult[];
  /** Human-readable reasons, only for rejections. */
  reasons: string[];
  confidence: number;
  engine: string;
  decidedAt: string;
  durationMs: number;
}

export interface VerificationRecord { submission: RegistrationSubmission; result: VerificationResult }

/** Async so a real (network) provider can be dropped in without UI changes. */
export interface VerificationProvider {
  name: string;
  verify(submission: RegistrationSubmission): Promise<VerificationResult>;
}

export const pipelineSteps = [
  "Document received",
  "Document extraction (OCR placeholder)",
  "Document validity checks",
  "Organization details consistency",
  "Required-document checks",
  "Role-specific eligibility",
  "AI verification decision",
] as const;
