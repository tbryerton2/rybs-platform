import "server-only";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function reorderDumpsterProducts(
  businessId: string,
  ids: string[],
  invalidate: (path: string) => void = revalidatePath,
) {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) {
    return { success: false, message: "Invalid product order. Refresh and try again." };
  }
  const { error } = await supabaseAdmin.rpc("reorder_dumpster_products", {
    p_business_id: businessId, p_ids: ids,
  });
  if (error) return { success: false, message: "Couldn't update order. Refresh and try again." };
  // All three routes resolve their tenant on the server. No admin refresh: preserve unsaved edits.
  invalidate("/");
  invalidate("/book");
  invalidate("/pricing");
  return { success: true, message: "Order updated" };
}
