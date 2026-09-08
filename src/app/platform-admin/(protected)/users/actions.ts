"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PlatformAdminOwnerRequiredError } from "@/lib/platform-admin/auth";
import {
  PlatformAdminUserMutationError,
  disablePlatformAdminUser,
  grantPlatformAdminUser,
  updatePlatformAdminUserRole,
} from "@/lib/platform-admin/users";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectMutationError(error: PlatformAdminUserMutationError): never {
  redirect(`/platform-admin/users?error=${encodeURIComponent(error.message)}`);
}

function redirectOwnerRequiredError(): never {
  redirect(
    `/platform-admin/users?error=${encodeURIComponent("Only active platform owners can manage Platform Users.")}`,
  );
}

export async function grantPlatformAdminUserAction(formData: FormData) {
  try {
    const result = await grantPlatformAdminUser({
      email: formString(formData, "email"),
      role: formString(formData, "role"),
    });

    revalidatePath("/platform-admin/users");
    redirect(
      `/platform-admin/users?status=${result.invited ? "invited" : "granted"}&email=${encodeURIComponent(result.email)}`,
    );
  } catch (error) {
    if (error instanceof PlatformAdminUserMutationError) {
      redirectMutationError(error);
    }

    if (error instanceof PlatformAdminOwnerRequiredError) {
      redirectOwnerRequiredError();
    }

    throw error;
  }
}

export async function updatePlatformAdminUserRoleAction(formData: FormData) {
  try {
    await updatePlatformAdminUserRole({
      membershipId: formString(formData, "membershipId"),
      role: formString(formData, "role"),
    });

    revalidatePath("/platform-admin/users");
    redirect("/platform-admin/users?status=role-updated");
  } catch (error) {
    if (error instanceof PlatformAdminUserMutationError) {
      redirectMutationError(error);
    }

    if (error instanceof PlatformAdminOwnerRequiredError) {
      redirectOwnerRequiredError();
    }

    throw error;
  }
}

export async function disablePlatformAdminUserAction(formData: FormData) {
  try {
    await disablePlatformAdminUser({
      membershipId: formString(formData, "membershipId"),
      confirmationEmail: formString(formData, "confirmationEmail"),
    });

    revalidatePath("/platform-admin/users");
    redirect("/platform-admin/users?status=disabled");
  } catch (error) {
    if (error instanceof PlatformAdminUserMutationError) {
      redirectMutationError(error);
    }

    if (error instanceof PlatformAdminOwnerRequiredError) {
      redirectOwnerRequiredError();
    }

    throw error;
  }
}
