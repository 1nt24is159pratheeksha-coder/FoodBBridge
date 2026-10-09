/** Server-side food image assessment through GroqCloud. */
import { parseAssessmentResult, requireManualReviewWhenConfidenceIsLow, QUALITY_STATUSES, type AssessmentResult } from "./assessment-result.ts";
import { GROQ_MODEL, requestGroq } from "./groq-ai.server.ts";
export type { AssessmentResult } from "./assessment-result";

export const FOOD_ASSESSMENT_MODEL = GROQ_MODEL;

interface AnalyzeOptions {
  foodName?: string;
  userQuantity?: number;
}

const GROQ_IMAGE_MIME_TYPES = new Set([
  "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif",
]);

function validateImagePayload(base64: string, contentType: string): void {
  if (!GROQ_IMAGE_MIME_TYPES.has(contentType.toLowerCase())) {
    throw new Error("Unsupported image MIME type");
  }
  if (!base64 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error("Invalid base64 image data");
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.toString("base64") !== base64) throw new Error("Invalid base64 image data");
}

function modelInstructions() {
  return [
    "Assess a photo of surplus cooked or prepared food for a food-rescue service.",
    "Return only a JSON object with food_name, estimated_portions, estimated_weight_kg, quality_screening_status, visual_quality, freshness, confidence_percent, assessment_note, and limitations.",
    `quality_screening_status must be one of: ${QUALITY_STATUSES.join(", ")}. visual_quality must be Good, Fair, or Poor. freshness must be Appears fresh, Signs of degradation, or Spoiled.`,
    "Identify food and estimate portions only when supported by visible evidence. Use zero portions only if no edible food is visible, never to represent uncertainty.",
    "Estimate weight only when the visible food and a reasonable scale support it; otherwise use 0 and explain the limitation.",
    "Report confidence from 0 to 100. Use REVIEW_REQUIRED when the image or estimate is unclear, unusual, or low confidence. Include at least one image-specific limitation.",
    "Never claim food is safe to eat. An image cannot establish microbial safety, temperature history, allergens, or handling conditions.",
    "Keep assessment_note to one short sentence.",
  ].join(" ");
}

const ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    food_name: { type: "string" },
    estimated_portions: { type: "integer", minimum: 0 },
    estimated_weight_kg: { type: "number", minimum: 0 },
    quality_screening_status: { type: "string", enum: [...QUALITY_STATUSES] },
    visual_quality: { type: "string", enum: ["Good", "Fair", "Poor"] },
    freshness: { type: "string", enum: ["Appears fresh", "Signs of degradation", "Spoiled"] },
    confidence_percent: { type: "integer", minimum: 0, maximum: 100 },
    assessment_note: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
  },
  required: ["food_name", "estimated_portions", "estimated_weight_kg", "quality_screening_status", "visual_quality", "freshness", "confidence_percent", "assessment_note", "limitations"],
  additionalProperties: false,
};

/** Extract one JSON object from final assistant content, including fenced or prefaced JSON. */
export function extractAssessmentJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("AI returned invalid structured JSON");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(text.slice(start, i + 1)) as unknown; }
        catch { throw new Error("AI returned invalid structured JSON"); }
      }
    }
  }
  throw new Error("AI returned invalid structured JSON");
}

/** Safe diagnostic label for local assessment validation failures. */
export function assessmentFailureCategory(error: unknown): string {
  if (!(error instanceof Error)) return "assessment_validation_failed";
  if (error.message === "AI returned invalid structured JSON") return "malformed_json";
  if (error.message.includes("did not identify")) return "missing_food_name";
  if (error.message.includes("portion estimate")) return "invalid_or_missing_portions";
  if (error.message.includes("weight estimate")) return "invalid_or_missing_weight";
  if (error.message.includes("visual screening status")) return "invalid_quality_status";
  if (error.message.includes("confidence")) return "invalid_confidence";
  if (error.message.includes("visual quality")) return "invalid_visual_quality";
  if (error.message.includes("freshness")) return "invalid_freshness";
  if (error.message.includes("observations or limitations")) return "missing_required_observations";
  return "assessment_validation_failed";
}

export async function analyzeFoodImage(
  base64: string,
  contentType: string,
  opts?: AnalyzeOptions,
): Promise<AssessmentResult> {
  if (!process.env["GROQ_API_KEY"]) throw new Error("GROQ_API_KEY missing — cannot perform AI assessment");
  validateImagePayload(base64, contentType);

  const contextHint = [
    opts?.foodName ? `The kitchen reported the food as: ${opts.foodName}.` : "",
    opts?.userQuantity ? `The kitchen reported approximately ${opts.userQuantity} portions.` : "",
  ].filter(Boolean).join(" ");
  const contentTypeNormalized = contentType.toLowerCase();
  const response = await requestGroq({
    messages: [
      { role: "system", content: modelInstructions() },
      { role: "user", content: [
        { type: "text", text: `Assess this surplus food photo. ${contextHint}`.trim() },
        { type: "image_url", image_url: { url: `data:${contentTypeNormalized};base64,${base64}` } },
      ] },
    ],
    max_completion_tokens: 700,
    response_format: { type: "json_schema", json_schema: { name: "food_assessment", strict: true, schema: ASSESSMENT_JSON_SCHEMA } },
  });
  if (!response.ok) {
    const status = response.httpStatus ? ` [${response.httpStatus}]` : "";
    throw new Error(`AI request failed${status} (${response.reason})`);
  }

  const parsed = extractAssessmentJson(response.text);
  return requireManualReviewWhenConfidenceIsLow(parseAssessmentResult(parsed, FOOD_ASSESSMENT_MODEL));
}
