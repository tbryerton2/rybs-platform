"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BusinessAdminUserMutationError,
  disableBusinessAdminUser,
  inviteBusinessAdminUser,
  resendBusinessAdminInvitation,
  updateBusinessAdminUserRole,
} from "@/lib/admin/users";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectMutationError(error: BusinessAdminUserMutationError): never {
  redirect(`/admin/settings/users?error=${encodeURIComponent(error.message)}`);
}

export async function inviteBusinessAdminUserAction(formData: FormData) {
  try {
    const result = await inviteBusinessAdminUser({
      email: formString(formData, "email"),
      role: formString(formData, "role"),
    });

    revalidatePath("/admin/settings/users");
    redirect(
      `/admin/settings/users?status=${result.pending ? "invited" : "granted"}&email=${encodeURIComponent(result.email)}`,
    );
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    throw error;
  }
}

export async function resendBusinessAdminInvitationAction(formData: FormData) {
  try {
    const result = await resendBusinessAdminInvitation({
      membershipId: formString(formData, "membershipId"),
    });

    revalidatePath("/admin/settings/users");
    redirect(`/admin/settings/users?status=resent&email=${encodeURIComponent(result.email)}`);
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    throw error;
  }
}

export async function updateBusinessAdminUserRoleAction(formData: FormData) {
  try {
    await updateBusinessAdminUserRole({
      membershipId: formString(formData, "membershipId"),
      role: formString(formData, "role"),
    });

    revalidatePath("/admin/settings/users");
    redirect("/admin/settings/users?status=role-updated");
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    throw error;
  }
}

export async function disableBusinessAdminUserAction(formData: FormData) {
  try {
    await disableBusinessAdminUser({
      membershipId: formString(formData, "membershipId"),
      confirmationEmail: formString(formData, "confirmationEmail"),
    });

    revalidatePath("/admin/settings/users");
    redirect("/admin/settings/users?status=removed");
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    throw error;
  }
}
