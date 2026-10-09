export const QUALITY_STATUSES = ["ELIGIBLE", "REVIEW_REQUIRED", "URGENT", "REJECTED"] as const;
export type Quality = (typeof QUALITY_STATUSES)[number];
export const ASSESSMENT_RETRY_MESSAGE = "I couldn't assess that photo, so no assessment was saved. Please try another clear photo or contact the team for manual review. Your current report is still open.";

export interface AssessmentResult {
  food_name: string;
  estimated_portions: number;
  estimated_weight_kg: number;
  quality_screening_status: Quality;
  assessment_note: string;
  analysis_mode: "live_ai" | "demo_simulation";
  model: string | null;
  visual_quality: string;
  freshness: string;
  confidence_percent: number;
  safety_status: string;
  limitations: string[];
}

export function parseAssessmentResult(value: unknown, model: string): AssessmentResult {
  if (!value || typeof value !== "object") throw new Error("Assessment result was not structured");
  const p = value as Record<string, unknown>;
  const statuses: readonly string[] = QUALITY_STATUSES;
  if (typeof p["food_name"] !== "string" || !p["food_name"].trim()) throw new Error("Assessment did not identify the food");
  if (!Number.isSafeInteger(p["estimated_portions"]) || (p["estimated_portions"] as number) < 0) throw new Error("Assessment returned an invalid portion estimate");
  if (typeof p["estimated_weight_kg"] !== "number" || !Number.isFinite(p["estimated_weight_kg"]) || p["estimated_weight_kg"] < 0) throw new Error("Assessment returned an invalid weight estimate");
  if (!statuses.includes(String(p["quality_screening_status"]))) throw new Error("Assessment returned an invalid visual screening status");
  if (!Number.isInteger(p["confidence_percent"]) || (p["confidence_percent"] as number) < 0 || (p["confidence_percent"] as number) > 100) throw new Error("Assessment returned invalid confidence");
  if (!(["Good", "Fair", "Poor"] as unknown[]).includes(p["visual_quality"])) throw new Error("Assessment returned invalid visual quality");
  if (!( ["Appears fresh", "Signs of degradation", "Spoiled"] as unknown[]).includes(p["freshness"])) throw new Error("Assessment returned invalid freshness observation");
  if (typeof p["assessment_note"] !== "string" || !Array.isArray(p["limitations"]) || p["limitations"].length < 1 || p["limitations"].some((item) => typeof item !== "string" || !item.trim())) throw new Error("Assessment omitted required observations or limitations");
  return {
    food_name: (p["food_name"] as string).trim().slice(0, 120),
    estimated_portions: p["estimated_portions"] as number,
    estimated_weight_kg: Math.round((p["estimated_weight_kg"] as number) * 10) / 10,
    quality_screening_status: p["quality_screening_status"] as Quality,
    assessment_note: (p["assessment_note"] as string).trim().slice(0, 300),
    analysis_mode: "live_ai",
    model,
    visual_quality: p["visual_quality"] as string,
    freshness: p["freshness"] as string,
    confidence_percent: p["confidence_percent"] as number,
    safety_status: p["quality_screening_status"] as string,
    limitations: (p["limitations"] as string[]).slice(0, 4).map((item) => item.trim().slice(0, 120)),
  };
}

export function requireManualReviewWhenConfidenceIsLow(result: AssessmentResult): AssessmentResult {
  if (result.confidence_percent >= 50) return result;
  return {
    ...result,
    quality_screening_status: "REVIEW_REQUIRED",
    safety_status: "REVIEW_REQUIRED",
    assessment_note: `Low reported visual confidence; manual review is required. ${result.assessment_note}`.slice(0, 300),
  };
}
