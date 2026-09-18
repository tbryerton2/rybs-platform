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

function redirectUnexpectedMutationError(error: unknown): never {
  console.error("[admin-users-action]", {
    event: "unexpected_mutation_error",
    message: error instanceof Error ? error.message : String(error),
  });

  redirect(
    `/admin/settings/users?error=${encodeURIComponent("We could not update Users. Try again in a moment.")}`,
  );
}

export async function inviteBusinessAdminUserAction(formData: FormData) {
  let result: Awaited<ReturnType<typeof inviteBusinessAdminUser>>;

  try {
    result = await inviteBusinessAdminUser({
      email: formString(formData, "email"),
      role: formString(formData, "role"),
    });
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    redirectUnexpectedMutationError(error);
  }

  revalidatePath("/admin/settings/users");
  redirect(
    `/admin/settings/users?status=${result.pending ? "invited" : "granted"}&email=${encodeURIComponent(result.email)}`,
  );
}

export async function resendBusinessAdminInvitationAction(formData: FormData) {
  let result: Awaited<ReturnType<typeof resendBusinessAdminInvitation>>;

  try {
    result = await resendBusinessAdminInvitation({
      membershipId: formString(formData, "membershipId"),
    });
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    redirectUnexpectedMutationError(error);
  }

  revalidatePath("/admin/settings/users");
  redirect(`/admin/settings/users?status=resent&email=${encodeURIComponent(result.email)}`);
}

export async function updateBusinessAdminUserRoleAction(formData: FormData) {
  try {
    await updateBusinessAdminUserRole({
      membershipId: formString(formData, "membershipId"),
      role: formString(formData, "role"),
    });
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    redirectUnexpectedMutationError(error);
  }

  revalidatePath("/admin/settings/users");
  redirect("/admin/settings/users?status=role-updated");
}

export async function disableBusinessAdminUserAction(formData: FormData) {
  try {
    await disableBusinessAdminUser({
      membershipId: formString(formData, "membershipId"),
      confirmationEmail: formString(formData, "confirmationEmail"),
    });
  } catch (error) {
    if (error instanceof BusinessAdminUserMutationError) {
      redirectMutationError(error);
    }

    redirectUnexpectedMutationError(error);
  }

  revalidatePath("/admin/settings/users");
  redirect("/admin/settings/users?status=removed");
}
