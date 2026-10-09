import { createLocalStore } from "@/lib/local-store";
import { evaluateSubmission, mockVerificationProvider } from "./mock-provider";
import type { DocumentType, OrgRole, RegistrationSubmission, VerificationProvider, VerificationRecord } from "./types";

/** Swap for a real provider later; the rest of the app only talks to this. */
export const verificationProvider: VerificationProvider = mockVerificationProvider;

type DocSpec = [type: DocumentType, nameOnDocument?: string | undefined, registrationNumber?: string | undefined, city?: string | undefined];
function seedRecord(id: string, orgName: string, role: OrgRole, city: string, address: string, docs: DocSpec[], ageSec: number): VerificationRecord {
  const at = new Date(Date.now() - ageSec * 1000).toISOString();
  const submission: RegistrationSubmission = {
    id, orgName, role, city, address, contactPhone: "+91 98450 00000", submittedAt: at,
    documents: docs.map(([type, name, reg, docCity]) => ({
      type, fileName: `${type.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
      extracted: { nameOnDocument: name ?? orgName, city: docCity ?? city, ...(reg ? { registrationNumber: reg } : {}) },
    })),
  };
  return { submission, result: { ...evaluateSubmission(submission), engine: verificationProvider.name, decidedAt: at, durationMs: 180 + (ageSec % 400) } };
}

const kitchenDocs = (fssai: string): DocSpec[] => [["FSSAI licence", undefined, fssai], ["Address proof"]];
const ngoDocs = (reg: string): DocSpec[] => [["NGO registration certificate", undefined, reg], ["Address proof"], ["80G / 12A certificate"]];

const seed = (): VerificationRecord[] => [
  seedRecord("V-1012", "Fresh Bites Cafe", "Kitchen", "Bengaluru", "Indiranagar", kitchenDocs("11224999000123"), 2),
  seedRecord("V-1011", "Annapurna Trust", "NGO", "Bengaluru", "Malleshwaram", ngoDocs("KA/BLR/2019/0042"), 5),
  seedRecord("V-1010", "Unknown Kitchen", "Kitchen", "Bengaluru", "BTM Layout", [["FSSAI licence", "Sri Sai Caterers", "11224999000777"], ["Address proof"]], 40),
  seedRecord("V-1009", "Quick Meals Stall", "Kitchen", "Bengaluru", "HSR Layout", [["Address proof"]], 600),
  seedRecord("V-1008", "City Hospital Kitchen", "Kitchen", "Bengaluru", "MG Road", kitchenDocs("10019022000456"), 1800),
  seedRecord("V-1007", "Helping Hands Foundation", "NGO", "Bengaluru", "Yelahanka", [["Unsupported document"], ["Address proof"]], 3600),
  seedRecord("V-1006", "Hope Shelter", "NGO", "Bengaluru", "Domlur", ngoDocs("KA/BLR/2016/0311"), 7200),
  seedRecord("V-1005", "Hotel Grand Spice", "Kitchen", "Bengaluru", "Whitefield", kitchenDocs("11221333000918"), 10800),
  seedRecord("V-1004", "Little Hearts Home", "NGO", "Bengaluru", "Jayanagar", ngoDocs("KA/BLR/2018/1180"), 86400),
  seedRecord("V-1003", "Campus Canteen", "Kitchen", "Bengaluru", "Jayanagar", kitchenDocs("11217888000334"), 90000),
  seedRecord("V-1002", "Feed The City", "NGO", "Bengaluru", "Shivajinagar", ngoDocs("KA/BLR/2014/0087"), 172800),
  seedRecord("V-1001", "Green Kitchen", "Kitchen", "Bengaluru", "Koramangala", kitchenDocs("11219555000671"), 259200),
];

export const verificationStore = createLocalStore<VerificationRecord[]>("resqfood.verification.v1", seed);
export const useVerificationRecords = verificationStore.useStore;

/** Registration → automated verification → decision stored. No admin step. */
export async function submitRegistration(submission: RegistrationSubmission) {
  const result = await verificationProvider.verify(submission);
  verificationStore.set((prev) => [{ submission, result }, ...prev]);
  return result;
}

export function verificationStats(records: VerificationRecord[]) {
  const verified = records.filter((r) => r.result.decision === "VERIFIED").length;
  const rejected = records.length - verified;
  return { verified, rejected, total: records.length, rate: records.length ? Math.round((verified / records.length) * 100) : 0 };
}

export const findVerification = (records: VerificationRecord[], orgName: string) => records.find((r) => r.submission.orgName === orgName);
