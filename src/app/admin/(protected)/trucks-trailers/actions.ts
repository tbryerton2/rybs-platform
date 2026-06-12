"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  createFleetEquipment,
  updateFleetEquipment,
} from "@/lib/admin/fleet-equipment";
import type {
  FleetEquipmentMutationInput,
  FleetEquipmentMutationResult,
} from "@/lib/admin/fleet-equipment-shared";

export async function createFleetEquipmentAction(
  input: FleetEquipmentMutationInput,
): Promise<FleetEquipmentMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await createFleetEquipment(input, adminSession.business.id);

  if (result.ok) {
    revalidatePath("/admin/trucks-trailers");
  }

  return result;
}

export async function updateFleetEquipmentAction(
  id: string,
  input: FleetEquipmentMutationInput,
): Promise<FleetEquipmentMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await updateFleetEquipment(id, input, adminSession.business.id);

  if (result.ok) {
    revalidatePath("/admin/trucks-trailers");
    revalidatePath(`/admin/trucks-trailers/${id}`);
    revalidatePath(`/admin/trucks-trailers/${id}/edit`);
  }

  return result;
}
