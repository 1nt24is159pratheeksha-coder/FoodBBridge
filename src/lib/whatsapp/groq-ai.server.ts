/** Server-only client for GroqCloud chat completions. */
export const GROQ_MODEL = "qwen/qwen3.8-27b";

export type GroqFailureReason =
  | "missing_key"
  | "invalid_key_or_permission"
  | "invalid_request"
  | "model_unavailable"
  | "rate_limited"
  | "api_error"
  | "timeout"
  | "network_error"
  | "malformed_output";

export type GroqResult =
  | { ok: true; text: string; model: string; httpStatus: number }
  | { ok: false; reason: GroqFailureReason; httpStatus?: number };

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;
};

export interface GroqRequest {
  messages: GroqMessage[];
  max_completion_tokens: number;
  response_format?: { type: "json_object" } | {
    type: "json_schema";
    json_schema: { name: string; strict: true; schema: Record<string, unknown> };
  };
}

function classifyStatus(status: number): GroqFailureReason {
  if (status === 400) return "invalid_request";
  if (status === 401 || status === 403) return "invalid_key_or_permission";
  if (status === 404) return "model_unavailable";
  if (status === 429) return "rate_limited";
  return "api_error";
}

export async function requestGroq(request: GroqRequest): Promise<GroqResult> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) return { ok: false, reason: "missing_key" };

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ model: GROQ_MODEL, ...request }),
    });
    if (!response.ok) return { ok: false, reason: classifyStatus(response.status), httpStatus: response.status };

    let result: { choices?: Array<{ message?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } }> };
    try { result = await response.json() as typeof result; }
    catch { return { ok: false, reason: "malformed_output", httpStatus: response.status }; }
    // For reasoning-capable models, the final answer is `content`; reasoning fields
    // are deliberately not treated as user-facing output or assessment data.
    const content = result.choices?.[0]?.message?.content;
    const text = typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content.map((part) => part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : "").join("").trim()
        : "";
    return text
      ? { ok: true, text, model: GROQ_MODEL, httpStatus: response.status }
      : { ok: false, reason: "malformed_output", httpStatus: response.status };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network_error" };
  }
}

/** Tiny text-only connectivity probe; returns no provider response content. */
export async function checkGroqConnectivity(): Promise<{ connected: boolean; httpStatus: number | null; errorCategory: GroqFailureReason | null }> {
  const result = await requestGroq({
    messages: [{ role: "user", content: "Reply with OK." }],
    max_completion_tokens: 8,
  });
  return result.ok
    ? { connected: true, httpStatus: result.httpStatus, errorCategory: null }
    : { connected: false, httpStatus: result.httpStatus ?? null, errorCategory: result.reason };
}

export async function requestGroqText(request: {
  instructions: string;
  input: string;
  maxOutputTokens: number;
  json?: boolean;
}): Promise<GroqResult> {
  return requestGroq({
    messages: [
      { role: "system", content: request.instructions },
      { role: "user", content: request.input },
    ],
    max_completion_tokens: request.maxOutputTokens,
    ...(request.json ? { response_format: { type: "json_object" } } : {}),
  });
}
