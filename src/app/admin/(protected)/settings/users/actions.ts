"use server";

import { revalidatePath } from "next/cache";
import { AdminAccessDeniedError } from "@/lib/admin/auth";
import {
  BusinessAdminUserMutationError,
  disableBusinessAdminUser, inviteBusinessAdminUser, resendBusinessAdminInvitation,
  updateBusinessAdminUserRole, updateBusinessAdminUserName, reactivateBusinessAdminUser,
} from "@/lib/admin/users";
import type { UserActionState } from "@/lib/admin/user-management-types";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
async function mutate(action: () => Promise<unknown>, message: string): Promise<UserActionState> {
  try {
    const result = await action();
    revalidatePath("/admin/settings/users");
    return { message, ...(typeof result === "object" && result && "membershipId" in result ? { membershipId: String(result.membershipId) } : {}) };
  } catch (error) {
    // Preserve Next.js navigation (e.g. a session expiring while a dialog is open).
    if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
    revalidatePath("/admin/settings/users");
    if (error instanceof BusinessAdminUserMutationError || error instanceof AdminAccessDeniedError) return { error: error.message };
    console.error("[admin-users-action]", { event: "unexpected_mutation_error", message: error instanceof Error ? error.message : String(error) });
    return { error: "We could not update this user. Refresh to check the latest state, then try again." };
  }
}
export async function inviteBusinessAdminUserAction(_: UserActionState, formData: FormData) {
  return mutate(() => inviteBusinessAdminUser({ firstName: formString(formData, "firstName"), lastName: formString(formData, "lastName"), email: formString(formData, "email"), role: formString(formData, "role") }), "Invitation sent.");
}
export async function resendBusinessAdminInvitationAction(_: UserActionState, formData: FormData) {
  return mutate(() => resendBusinessAdminInvitation({ membershipId: formString(formData, "membershipId") }), "Invitation resent.");
}
export async function updateBusinessAdminUserRoleAction(_: UserActionState, formData: FormData) {
  return mutate(() => updateBusinessAdminUserRole({ membershipId: formString(formData, "membershipId"), role: formString(formData, "role") }), "Role updated.");
}
export async function updateBusinessAdminUserNameAction(_: UserActionState, formData: FormData) {
  return mutate(() => updateBusinessAdminUserName({ membershipId: formString(formData, "membershipId"), firstName: formString(formData, "firstName"), lastName: formString(formData, "lastName") }), "Name saved.");
}
export async function disableBusinessAdminUserAction(_: UserActionState, formData: FormData) {
  return mutate(() => disableBusinessAdminUser({ membershipId: formString(formData, "membershipId"), confirmationEmail: formString(formData, "confirmationEmail") }), "Business access deactivated.");
}
export async function reactivateBusinessAdminUserAction(_: UserActionState, formData: FormData) {
  return mutate(() => reactivateBusinessAdminUser({ membershipId: formString(formData, "membershipId") }), "Business access reactivated.");
}
