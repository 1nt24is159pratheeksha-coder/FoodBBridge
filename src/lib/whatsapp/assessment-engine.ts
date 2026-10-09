/**
 * Food image assessment engine — extends the existing pipeline.server.ts
 * AI vision call with additional structured fields:
 *   visual_quality, freshness, confidence_percent, safety_status
 *
 * Uses the same Lovable AI gateway / Gemini model as pipeline.server.ts.
 * On any failure, returns REVIEW_REQUIRED — NEVER fabricates a safe result.
 */

const MODEL = "google/gemini-3-flash-preview";

const QUALITY_STATUSES = ["ELIGIBLE", "REVIEW_REQUIRED", "URGENT", "REJECTED"] as const;
type Quality = (typeof QUALITY_STATUSES)[number];

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
}

interface AnalyzeOptions {
  foodName?: string;
  userQuantity?: number;
}

export async function analyzeFoodImage(
  base64: string,
  contentType: string,
  opts?: AnalyzeOptions,
): Promise<AssessmentResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY missing — cannot perform AI assessment");

  const contextHint = [
    opts?.foodName ? `The kitchen reported the food as: ${opts.foodName}.` : "",
    opts?.userQuantity ? `The kitchen reported approximately ${opts.userQuantity} portions.` : "",
  ].filter(Boolean).join(" ");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You assist an institutional food-rescue service. Look at a photo of surplus cooked/prepared food from a kitchen. " +
            "Identify the food, estimate how many standard adult portions (~300-450 g each) are visible, and the total food weight in kg. " +
            "Perform a visual quality screening and provide structured assessment data. " +
            "Visual quality options: Good, Fair, Poor. " +
            "Freshness options: Appears fresh, Signs of degradation, Spoiled. " +
            "Quality screening status options: ELIGIBLE (no visible issues), REVIEW_REQUIRED (unclear image, unusual appearance, can't judge), " +
            "URGENT (looks fine but appears to be degrading / should move very soon), REJECTED (visible spoilage, mould, contamination, or not food). " +
            "Never claim food is safe; you only screen visible characteristics. " +
            "Confidence is your confidence in the identification and estimates (0-100). " +
            "Keep the assessment note to one short sentence.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Assess this surplus food photo.${contextHint ? " " + contextHint : ""}`,
            },
            { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "report_assessment",
            description: "Report the structured visual food assessment",
            parameters: {
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
              },
              required: [
                "food_name",
                "estimated_portions",
                "estimated_weight_kg",
                "quality_screening_status",
                "visual_quality",
                "freshness",
                "confidence_percent",
                "assessment_note",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "report_assessment" } },
    }),
  });

  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);

  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured result");

  const p = JSON.parse(args);
  const status = QUALITY_STATUSES.includes(p.quality_screening_status)
    ? p.quality_screening_status
    : "REVIEW_REQUIRED";

  return {
    food_name: String(p.food_name).slice(0, 120),
    estimated_portions: Math.max(0, Math.round(Number(p.estimated_portions) || 0)),
    estimated_weight_kg: Math.max(0, Math.round((Number(p.estimated_weight_kg) || 0) * 10) / 10),
    quality_screening_status: status,
    assessment_note: String(p.assessment_note).slice(0, 300),
    analysis_mode: "live_ai",
    model: MODEL,
    visual_quality: String(p.visual_quality ?? "Unknown"),
    freshness: String(p.freshness ?? "Unknown"),
    confidence_percent: Math.max(0, Math.min(100, Math.round(Number(p.confidence_percent) || 0))),
    safety_status: status,
  };
}
