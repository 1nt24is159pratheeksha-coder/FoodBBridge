export function remainingOfferQuantity(quantity: number, acceptedQuantity: number): number {
  return Math.max(0, quantity - acceptedQuantity);
}

export function isAvailableOffer(state: string, availableQuantity: number, usableUntil: string | null, now = Date.now()): boolean {
  const allowedState = state === "ASSESSMENT_COMPLETE" || state === "AVAILABLE";
  const notExpired = usableUntil == null || new Date(usableUntil).getTime() > now;
  return allowedState && availableQuantity > 0 && notExpired;
}
