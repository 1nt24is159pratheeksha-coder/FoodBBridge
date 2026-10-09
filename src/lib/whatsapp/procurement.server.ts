/**
 * Smart procurement service (server-side only).
 *
 * Calculates required ingredients based on:
 *   - Predicted demand (from forecast)
 *   - Recipe / Bill of Materials (BOM)
 *   - Current inventory
 *   - Recommended purchase quantities
 *
 * Does NOT place supplier orders — that requires a real supplier API.
 * Builds the calculation structure so procurement can be automated later.
 */

interface Ingredient {
  name: string;
  unit: string;
  amount_per_serving: number;
}

interface BomRecipe {
  id: string;
  kitchen_id: string;
  dish_name: string;
  servings_per_recipe: number;
  ingredients: Ingredient[];
}

interface InventoryItem {
  id: string;
  kitchen_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export interface ProcurementResult {
  dish_name: string;
  predicted_servings: number;
  ingredients: {
    name: string;
    required: number;
    unit: string;
    in_stock: number;
    recommended_purchase: number;
    inventory_recorded: boolean;
  }[];
  note: string;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function calculateProcurement(
  kitchenId: string,
  predictedServings: number,
  dishName?: string,
): Promise<ProcurementResult[]> {
  const supabase = (await db()) as unknown as SupabaseClient;

  // Fetch BOM recipes for this kitchen
  let query = supabase.from("bom_recipes").select("*").eq("kitchen_id", kitchenId);
  if (dishName) {
    query = query.ilike("dish_name", `%${dishName}%`);
  }
  const { data: recipes, error: rErr } = await query;
  if (rErr) throw new Error(`Procurement: recipe fetch failed: ${rErr.message}`);
  if (!recipes?.length) {
    return [{
      dish_name: dishName ?? "Unknown",
      predicted_servings: predictedServings,
      ingredients: [],
      note: "No BOM recipe configured for this dish. Add a recipe to get procurement recommendations.",
    }];
  }

  // Fetch inventory for this kitchen
  const { data: inventory, error: iErr } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("kitchen_id", kitchenId);
  if (iErr) throw new Error(`Procurement: inventory fetch failed: ${iErr.message}`);

  const inventoryMap = new Map<string, InventoryItem>();
  for (const item of (inventory ?? []) as unknown as InventoryItem[]) {
    inventoryMap.set(item.ingredient_name.toLowerCase(), item);
  }

  const results: ProcurementResult[] = [];
  const menuMixNote = recipes.length > 1 && !dishName
    ? "Menu mix is not recorded. Each dish is shown as a separate what-if that assumes it supplies 100% of forecast meals; do not add purchase amounts across dishes."
    : "";

  for (const recipe of recipes as unknown as BomRecipe[]) {
    const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []) as Ingredient[];
    const ingredientResults = ingredients.map((ing) => {
      const required = Math.round(ing.amount_per_serving * predictedServings * 100) / 100;
      const invItem = inventoryMap.get(ing.name.toLowerCase());
      const inStock = invItem?.quantity ?? 0;
      const recommendedPurchase = Math.max(0, Math.round((required - inStock) * 100) / 100);

      return {
        name: ing.name,
        required,
        unit: ing.unit,
        in_stock: inStock,
        recommended_purchase: recommendedPurchase,
        inventory_recorded: Boolean(invItem),
      };
    });

    results.push({
      dish_name: recipe.dish_name,
      predicted_servings: predictedServings,
      ingredients: ingredientResults,
      note: [inventory?.length
        ? "Required quantities use the recipe's per-serving amounts. Purchase quantity is required minus recorded stock; this calculation does not place orders."
        : "No inventory items are recorded for this kitchen. Buy quantities assume zero recorded stock; update inventory for accurate recommendations.", menuMixNote].filter(Boolean).join(" "),
    });
  }

  return results;
}

export function formatProcurementResult(results: ProcurementResult[]): string {
  const lines: string[] = [];

  for (const r of results) {
    lines.push(`🍽️ *${r.dish_name}* — ${r.predicted_servings} servings`, "");

    if (r.ingredients.length === 0) {
      lines.push(r.note, "");
      continue;
    }

    lines.push("Required | In stock | Buy | Unit");
    for (const ing of r.ingredients) {
      lines.push(`• ${ing.name}: ${ing.required} | ${ing.in_stock} | ${ing.recommended_purchase} | ${ing.unit}`);
    }
    lines.push("", r.note, "");
  }

  return lines.join("\n");
}
import type { SupabaseClient } from "@supabase/supabase-js";

