import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  tripId: z.string().uuid(),
});

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
  })).min(1),
});

export const askAgnesAboutTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: driver, error: driverError } = await supabaseAdmin
      .from("drivers")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (driverError || !driver || driver.status !== "approved") {
      throw new Error("Agnes AI is available only to approved drivers.");
    }

    const { data: allocation, error: allocationError } = await supabaseAdmin
      .from("allocations")
      .select("id, quantity, delivery_status, surplus_food(food_name, unit, pickup_location, kitchens(address)), ngos(address)")
      .eq("id", data.tripId)
      .eq("driver_id", driver.id)
      .maybeSingle();
    if (allocationError || !allocation) {
      throw new Error("This trip is not assigned to your driver account.");
    }
    const apiKey = process.env.AGNES_API_KEY;
    if (!apiKey) throw new Error("Agnes AI is not configured. Set AGNES_API_KEY on the server.");

    const surplus = allocation.surplus_food as unknown as null | {
      food_name: string; unit: string; pickup_location: string | null;
      kitchens: null | { address: string | null };
    };
    const ngo = allocation.ngos as unknown as null | { address: string | null };
    const trip = {
      food: surplus?.food_name ?? "Food allocation",
      quantity: `${allocation.quantity} ${surplus?.unit ?? "portions"}`,
      pickupLocation: surplus?.pickup_location ?? surplus?.kitchens?.address ?? "Address not provided",
      deliveryLocation: ngo?.address ?? "Address not provided",
      status: allocation.delivery_status ?? "Unknown",
    };
    const { question } = data;
    let response: Response;
    try {
      response = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "agnes-3.0-flash",
          temperature: 0.3,
          max_tokens: 220,
          stream: false,
          messages: [
            {
              role: "system",
              content: "You are Agnes AI, a concise food-rescue driver assistant. Use only the provided trip details to explain the next appropriate step. Remind the driver to follow the app's OTP verification process at pickup or delivery when relevant. Never claim you performed, accepted, rejected, or changed a trip action. The app controls all trip actions. If asked to change a trip, say to use the app controls.",
            },
            {
              role: "user",
              content: `Trip context: ${JSON.stringify(trip)}\nDriver question: ${question}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("Agnes AI could not be reached. Please try again.");
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Agnes AI could not authorize this request. Check the server API key.");
      }
      throw new Error("Agnes AI is temporarily unavailable. Please try again.");
    }

    try {
      const payload: unknown = await response.json();
      const parsed = responseSchema.safeParse(payload);
      const answer = parsed.success ? parsed.data.choices[0]?.message.content.trim() : "";
      if (!answer) throw new Error("empty response");
      return { answer };
    } catch {
      throw new Error("Agnes AI returned an unreadable answer. Please try again.");
    }
  });
