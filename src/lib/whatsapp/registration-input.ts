export const REGISTRATION_KEYS = ["name", "contact_name", "email", "address", "city", "organization_type", "operating_hours", "daily_meals", "capacity_meals", "food_requirements", "availability"] as const;

export function isConversationalQuestion(text: string): boolean {
  return text.includes("?") || /\b(?:can|could|would|should|what|how|why|when|where|who|is|are|do|does|will)\b/i.test(text)
    || /\b(?:clarify|explain|question|change this later)\b/i.test(text);
}

export function parseRegistrationCapacity(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const capacity = Number(trimmed);
  return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : null;
}

export function parseRegistrationCapacityAnswer(text: string, extracted?: unknown): number | null {
  const trimmed = text.trim();
  const plainNumber = /^\d+$/.test(trimmed) ? trimmed : null;
  const mealCount = trimmed.match(/\b(\d+)\s*(?:meals?|portions?|beneficiaries)\b/i)?.[1]
    ?? trimmed.match(/\b(?:around|about|approximately)\s+(\d+)\b/i)?.[1]
    ?? null;
  const explicitNumber = plainNumber ?? mealCount;
  if (!explicitNumber) return null;
  if (extracted !== undefined && String(extracted) !== explicitNumber) return null;
  return parseRegistrationCapacity(explicitNumber);
}

export function extractRegistrationFields(text: string): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  const city = text.match(/\b(?:in|based in|located in)\s+([A-Z][\w -]{1,40}?)(?=\s+(?:and|serv(?:e|es)|with|we|around|about|daily|$)|[,.;]|$)/i)?.[1]?.trim();
  if (city) fields["city"] = city;
  const org = text.match(/\b(restaurant|cafeteria|cafe|canteen|hotel|hospital|school|shelter|food bank|orphanage|charity)\b/i)?.[1];
  if (org) fields["organization_type"] = org;
  const meals = text.match(/\b(?:around|about|approximately|serve|serves|serving|capacity of)?\s*(\d+)\s*(?:meals?|portions?|beneficiaries)?\s*(?:every day|daily|per day)\b/i)
    ?? text.match(/\b(?:around|about|approximately)\s*(\d+)\s*(?:meals?|portions?)?\b/i);
  if (meals) fields["daily_meals"] = Number(meals[1]);
  const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
  if (email) fields["email"] = email;
  return fields;
}
