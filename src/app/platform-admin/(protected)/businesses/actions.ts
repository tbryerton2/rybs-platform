"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PlatformDomainMutationError,
  activatePlatformTenantDomain,
  checkPlatformTenantDomain,
  createPlatformTenantDomain,
  disablePlatformTenantDomain,
  provisionPlatformTenantDomain,
  removePlatformTenantDomain,
  setPlatformTenantDomainPrimary,
  updatePlatformTenantDomain,
} from "@/lib/platform-admin/domains";
import {
  PlatformTenantMutationError,
  assignExistingUserAsBusinessAdmin,
  createPlatformTenant,
  updatePlatformTenantBasic,
  updatePlatformTenantImplementation,
  updatePlatformTenantLifecycleStatus,
} from "@/lib/platform-admin/tenants";
import type { PlatformBusinessFormState, PlatformBusinessFormValues } from "./form-state";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function createValues(formData: FormData): PlatformBusinessFormValues {
  return {
    businessName: formString(formData, "businessName"),
    slug: formString(formData, "slug"),
    status: formString(formData, "status") || "inactive",
  };
}

function editValues(formData: FormData): PlatformBusinessFormValues {
  return {
    businessName: formString(formData, "businessName"),
    slug: formString(formData, "slug"),
    status: formString(formData, "status"),
  };
}

function mutationErrorState(
  error: PlatformTenantMutationError,
  values: PlatformBusinessFormValues,
): PlatformBusinessFormState {
  return {
    status: "error",
    message: error.message,
    fieldErrors: error.field ? { [error.field]: error.message } : undefined,
    values,
  };
}

function revalidatePlatformBusiness(tenantId: string) {
  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/businesses");
  revalidatePath(`/platform-admin/businesses/${tenantId}`);
}

function redirectDomainMutationError(tenantId: string, error: PlatformDomainMutationError): never {
  redirect(`/platform-admin/businesses/${tenantId}?error=${encodeURIComponent(error.message)}`);
}

export async function createBusinessAction(
  _previousState: PlatformBusinessFormState,
  formData: FormData,
): Promise<PlatformBusinessFormState> {
  const values = createValues(formData);
  let createdTenantId: string;

  try {
    const result = await createPlatformTenant(values);
    createdTenantId = result.tenantId;
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      return mutationErrorState(error, values);
    }

    throw error;
  }

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/businesses");
  redirect(`/platform-admin/businesses/${createdTenantId}`);
}

export async function updateBusinessAction(
  _previousState: PlatformBusinessFormState,
  formData: FormData,
): Promise<PlatformBusinessFormState> {
  const values = editValues(formData);
  const tenantId = formString(formData, "tenantId");
  let updatedTenantId: string;

  try {
    const result = await updatePlatformTenantBasic({
      tenantId,
      businessName: values.businessName,
      slug: values.slug,
      expectedUpdatedAt: formString(formData, "expectedUpdatedAt"),
    });
    updatedTenantId = result.tenantId;
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      return mutationErrorState(error, values);
    }

    throw error;
  }

  revalidatePath("/platform-admin");
  revalidatePath("/platform-admin/businesses");
  revalidatePath(`/platform-admin/businesses/${updatedTenantId}`);
  redirect(`/platform-admin/businesses/${updatedTenantId}?status=updated`);
}

export async function activateBusinessAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await updatePlatformTenantLifecycleStatus({
      tenantId,
      targetStatus: "active",
      acknowledgeIncompleteSetup: formBoolean(formData, "acknowledgeIncompleteSetup"),
    });

    revalidatePath("/platform-admin");
    revalidatePath("/platform-admin/businesses");
    revalidatePath(`/platform-admin/businesses/${result.tenantId}`);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=activated`);
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      redirect(`/platform-admin/businesses/${tenantId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function updateImplementationTypeAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await updatePlatformTenantImplementation({
      tenantId,
      implementationType: formString(formData, "implementationType"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=implementation-updated`);
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      redirect(`/platform-admin/businesses/${tenantId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function assignBusinessAdminAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await assignExistingUserAsBusinessAdmin({
      tenantId,
      email: formString(formData, "email"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=admin-assigned`);
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      redirect(`/platform-admin/businesses/${tenantId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function deactivateBusinessAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await updatePlatformTenantLifecycleStatus({
      tenantId,
      targetStatus: "inactive",
      confirmationSlug: formString(formData, "confirmationSlug"),
      currentSiteConfirmation: formString(formData, "currentSiteConfirmation"),
    });

    revalidatePath("/platform-admin");
    revalidatePath("/platform-admin/businesses");
    revalidatePath(`/platform-admin/businesses/${result.tenantId}`);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=deactivated`);
  } catch (error) {
    if (error instanceof PlatformTenantMutationError) {
      redirect(`/platform-admin/businesses/${tenantId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

export async function createDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await createPlatformTenantDomain({
      tenantId,
      hostname: formString(formData, "hostname"),
      domainType: formString(formData, "domainType"),
      status: formString(formData, "status") || "pending",
      isPrimary: formBoolean(formData, "isPrimary"),
    });

    await provisionPlatformTenantDomain({
      tenantId: result.tenantId,
      domainId: result.domainId,
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-added`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function updateDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await updatePlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
      domainType: formString(formData, "domainType"),
      status: formString(formData, "status"),
      isPrimary: formBoolean(formData, "isPrimary"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-updated`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function provisionDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await provisionPlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-provisioned`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function checkDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await checkPlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-checked`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function activateDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await activatePlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-activated`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function disableDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await disablePlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-disabled`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function makePrimaryDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await setPlatformTenantDomainPrimary({
      tenantId,
      domainId: formString(formData, "domainId"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-primary`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}

export async function removeDomainAction(formData: FormData) {
  const tenantId = formString(formData, "tenantId");

  try {
    const result = await removePlatformTenantDomain({
      tenantId,
      domainId: formString(formData, "domainId"),
      confirmation: formString(formData, "confirmation"),
      clearPrimary: formBoolean(formData, "clearPrimary"),
      acknowledgeLastActive: formBoolean(formData, "acknowledgeLastActive"),
    });

    revalidatePlatformBusiness(result.tenantId);
    redirect(`/platform-admin/businesses/${result.tenantId}?status=domain-removed`);
  } catch (error) {
    if (error instanceof PlatformDomainMutationError) {
      redirectDomainMutationError(tenantId, error);
    }

    throw error;
  }
}
