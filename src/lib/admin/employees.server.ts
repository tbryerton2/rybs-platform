import "server-only";

import { diffEntityFields, recordEntityHistory } from "@/lib/entity-history";
import { normalizeEmail } from "@/lib/identity";
import { getCurrentTenant } from "@/lib/tenant/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  createEmptyEmployee,
  normalizeEmployeeMutationInput,
  toEmployeeMutationInput,
  validateEmployee,
  type EmployeeFormErrors,
  type EmployeeMutationInput,
  type EmployeePreferredContactMethod,
  type EmployeeRecord,
  type EmployeeRoleKey,
  type EmployeeStatus,
} from "./employees";

/**
 * Employee records belong to a single business (currently mapped to the tenant model),
 * are soft-deactivated instead of deleted, and can later link to auth users without
 * making a login account mandatory for every employee row.
 */

type BusinessEmployeeRow = {
  id: string;
  business_id: string;
  employee_code: string | null;
  first_name: string;
  last_name: string;
  full_name: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  job_title: string | null;
  phone: string | null;
  second_phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  preferred_contact_method: string | null;
  role_key: string | null;
  status: string;
  is_active: boolean;
  deactivated_at: string | null;
  deactivation_reason: string | null;
  notes: string | null;
  linked_user_id: string | null;
  license_number: string | null;
  license_state: string | null;
  license_class: string | null;
  license_expiration: string | null;
  hire_date: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type EmployeeListFilter = {
  includeInactive?: boolean;
};

export type EmployeeMutationResult =
  | {
      ok: true;
      employee: EmployeeRecord;
      message: string;
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: EmployeeFormErrors;
    };

const BUSINESS_EMPLOYEE_SELECT = `
  id,
  business_id,
  employee_code,
  first_name,
  last_name,
  full_name,
  street_address,
  city,
  state,
  postal_code,
  job_title,
  phone,
  second_phone,
  email,
  date_of_birth,
  preferred_contact_method,
  role_key,
  status,
  is_active,
  deactivated_at,
  deactivation_reason,
  notes,
  linked_user_id,
  license_number,
  license_state,
  license_class,
  license_expiration,
  hire_date,
  emergency_contact_name,
  emergency_contact_phone,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanRequiredText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizePhone(value: string | null | undefined) {
  return value ? value.replace(/\D/g, "") || null : null;
}

function normalizeState(value: string | null | undefined) {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed.slice(0, 2) : null;
}

function normalizeZip(value: string | null | undefined) {
  return value ? value.replace(/\D/g, "").slice(0, 5) || null : null;
}

function toEmployeeStatus(input: EmployeeMutationInput) {
  if (input.status === "invited") return "invited" satisfies EmployeeStatus;
  return input.active ? "active" : "inactive";
}

function normalizeRoleKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? (trimmed as EmployeeRoleKey) : null;
}

function normalizePreferredContactMethod(
  value: EmployeePreferredContactMethod | string | null | undefined,
): EmployeePreferredContactMethod {
  return value === "text" || value === "email" ? value : "phone";
}

function parseGeneratedEmployeeCodeNumber(value: string | null | undefined) {
  const match = value?.match(/^EMP-(\d+)$/);
  if (!match) return null;

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapRowToEmployeeRecord(row: BusinessEmployeeRow): EmployeeRecord {
  const empty = createEmptyEmployee();

  return {
    ...empty,
    id: row.id,
    businessId: row.business_id,
    employeeId: row.employee_code ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name ?? `${row.first_name} ${row.last_name}`.trim(),
    streetAddress: row.street_address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    zip: row.postal_code ?? "",
    jobTitle: row.job_title ?? "",
    phone: row.phone ?? "",
    secondPhone: row.second_phone ?? "",
    email: row.email ?? "",
    dateOfBirth: row.date_of_birth ?? "",
    active: row.is_active,
    status: (row.status as EmployeeStatus) ?? "active",
    notes: row.notes ?? "",
    licenseNumber: row.license_number ?? "",
    licenseState: row.license_state ?? "",
    licenseClass: row.license_class ?? "",
    licenseExpiration: row.license_expiration ?? "",
    hireDate: row.hire_date ?? "",
    emergencyContactName: row.emergency_contact_name ?? "",
    emergencyContactPhone: row.emergency_contact_phone ?? "",
    preferredContactMethod: normalizePreferredContactMethod(row.preferred_contact_method),
    roleKey: (row.role_key as EmployeeRoleKey | null) ?? "",
    linkedUserId: row.linked_user_id,
    deactivatedAt: row.deactivated_at,
    deactivationReason: row.deactivation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
  };
}

function buildEmployeeWriteValues(
  businessId: string,
  input: EmployeeMutationInput,
  options?: {
    actorUserId?: string | null;
    deactivatedAt?: string | null;
  },
) {
  const normalizedInput = normalizeEmployeeMutationInput(input);
  const status = toEmployeeStatus(normalizedInput);
  const deactivatedAt =
    status === "inactive"
      ? options?.deactivatedAt ?? normalizedInput.deactivatedAt ?? new Date().toISOString()
      : null;

  return {
    business_id: businessId,
    employee_code: cleanText(normalizedInput.employeeId)?.toUpperCase() ?? null,
    first_name: cleanRequiredText(normalizedInput.firstName),
    last_name: cleanRequiredText(normalizedInput.lastName),
    street_address: cleanText(normalizedInput.streetAddress),
    city: cleanText(normalizedInput.city),
    state: normalizeState(normalizedInput.state),
    postal_code: normalizeZip(normalizedInput.zip),
    job_title: cleanText(normalizedInput.jobTitle),
    phone: normalizePhone(normalizedInput.phone),
    second_phone: normalizePhone(normalizedInput.secondPhone),
    email: normalizeEmail(normalizedInput.email),
    date_of_birth: cleanText(normalizedInput.dateOfBirth),
    preferred_contact_method: normalizePreferredContactMethod(normalizedInput.preferredContactMethod),
    role_key: normalizeRoleKey(normalizedInput.roleKey),
    status,
    deactivated_at: deactivatedAt,
    deactivation_reason:
      status === "inactive"
        ? cleanText(normalizedInput.deactivationReason) ?? "Soft-deactivated from the admin employees page."
        : null,
    notes: cleanText(normalizedInput.notes),
    linked_user_id: cleanText(normalizedInput.linkedUserId),
    license_number: cleanText(normalizedInput.licenseNumber)?.toUpperCase() ?? null,
    license_state: normalizeState(normalizedInput.licenseState),
    license_class: cleanText(normalizedInput.licenseClass),
    license_expiration: cleanText(normalizedInput.licenseExpiration),
    hire_date: cleanText(normalizedInput.hireDate),
    emergency_contact_name: cleanText(normalizedInput.emergencyContactName),
    emergency_contact_phone: normalizePhone(normalizedInput.emergencyContactPhone),
    updated_by: options?.actorUserId ?? null,
  };
}

function buildConstraintError(message: string): {
  error: string;
  fieldErrors?: EmployeeFormErrors;
} {
  const normalized = message.toLowerCase();

  if (normalized.includes("business_employees_business_id_normalized_email_key")) {
    return {
      error: "That email is already used by another employee record for this business.",
      fieldErrors: { email: "Email must be unique within the business." },
    };
  }

  if (normalized.includes("business_employees_business_id_employee_code_key")) {
    return {
      error: "That employee ID is already used by another employee record for this business.",
      fieldErrors: { employeeId: "Employee ID must be unique within the business." },
    };
  }

  if (normalized.includes("business_employees_employee_code_format_check")) {
    return {
      error: "Employee ID must use letters, numbers, and hyphens only.",
      fieldErrors: { employeeId: "Use letters, numbers, and hyphens only." },
    };
  }

  return {
    error: "Unable to save the employee record right now.",
  };
}

async function findDuplicateEmployeeField(
  businessId: string,
  field: "employee_code" | "normalized_email",
  value: string | null,
  excludeId?: string,
) {
  if (!value) return null;

  let query = supabaseAdmin
    .from("business_employees")
    .select("id")
    .eq("business_id", businessId)
    .eq(field, value)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function getNextEmployeeCodeForBusiness(businessId: string) {
  const { data, error } = await supabaseAdmin
    .from("business_employees")
    .select("employee_code")
    .eq("business_id", businessId)
    .ilike("employee_code", "EMP-%");

  if (error) {
    throw new Error(error.message);
  }

  const maxExisting = (data ?? []).reduce((currentMax, row) => {
    const nextValue = parseGeneratedEmployeeCodeNumber((row as { employee_code: string | null }).employee_code);
    return nextValue && nextValue > currentMax ? nextValue : currentMax;
  }, 1000);

  return `EMP-${maxExisting + 1}`;
}

export async function listEmployeesForCurrentBusiness(filter?: EmployeeListFilter) {
  const tenant = await getCurrentTenant();
  let query = supabaseAdmin
    .from("business_employees")
    .select(BUSINESS_EMPLOYEE_SELECT)
    .eq("business_id", tenant.id)
    .order("is_active", { ascending: false })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (!filter?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as BusinessEmployeeRow[]).map(mapRowToEmployeeRecord);
}

export async function getEmployeeForCurrentBusiness(id: string) {
  const tenant = await getCurrentTenant();
  const { data, error } = await supabaseAdmin
    .from("business_employees")
    .select(BUSINESS_EMPLOYEE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapRowToEmployeeRecord(data as BusinessEmployeeRow);
}

export async function getNextEmployeeCodeForCurrentBusiness() {
  const tenant = await getCurrentTenant();
  return getNextEmployeeCodeForBusiness(tenant.id);
}

export async function createEmployeeForCurrentBusiness(
  input: EmployeeMutationInput,
  actorUserId?: string | null,
): Promise<EmployeeMutationResult> {
  const tenant = await getCurrentTenant();
  const generatedEmployeeId = await getNextEmployeeCodeForBusiness(tenant.id);
  const normalizedInput = normalizeEmployeeMutationInput({
    ...input,
    employeeId: generatedEmployeeId,
  });
  const fieldErrors = validateEmployee(normalizedInput, { requireEmployeeId: false });
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please fix the highlighted employee fields.",
      fieldErrors,
    };
  }

  const duplicateEmailId = await findDuplicateEmployeeField(
    tenant.id,
    "normalized_email",
    normalizeEmail(normalizedInput.email),
  );
  if (duplicateEmailId) {
    return {
      ok: false,
      error: "That email is already used by another employee record for this business.",
      fieldErrors: { email: "Email must be unique within the business." },
    };
  }

  const duplicateCodeId = await findDuplicateEmployeeField(
    tenant.id,
    "employee_code",
    cleanText(normalizedInput.employeeId)?.toUpperCase() ?? null,
  );
  if (duplicateCodeId) {
    const regeneratedEmployeeId = await getNextEmployeeCodeForBusiness(tenant.id);
    normalizedInput.employeeId = regeneratedEmployeeId;
  }

  const duplicateRegeneratedCodeId = await findDuplicateEmployeeField(
    tenant.id,
    "employee_code",
    cleanText(normalizedInput.employeeId)?.toUpperCase() ?? null,
  );
  if (duplicateRegeneratedCodeId) {
    return {
      ok: false,
      error: "Unable to generate a new employee ID right now. Please try again.",
      fieldErrors: { employeeId: "Unable to generate a unique employee ID right now." },
    };
  }

  const values = {
    ...buildEmployeeWriteValues(tenant.id, normalizedInput, { actorUserId }),
    created_by: actorUserId ?? null,
  };

  const { data, error } = await supabaseAdmin
    .from("business_employees")
    .insert(values)
    .select(BUSINESS_EMPLOYEE_SELECT)
    .single();

  if (error || !data) {
    const constraintError = buildConstraintError(error?.message ?? "Unable to create employee.");
    return {
      ok: false,
      error: constraintError.error,
      fieldErrors: constraintError.fieldErrors,
    };
  }

  const employee = mapRowToEmployeeRecord(data as BusinessEmployeeRow);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "employee",
      entityId: employee.id,
      fieldName: "__created__",
      oldValue: null,
      newValue: JSON.stringify({
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        status: employee.status,
      }),
      changedByType: "admin",
      changedById: actorUserId ?? null,
      changeReason: "Employee record created from admin",
    },
  ], tenant.id);

  return {
    ok: true,
    employee,
    message: "Employee created.",
  };
}

export async function updateEmployeeForCurrentBusiness(
  id: string,
  input: EmployeeMutationInput,
  actorUserId?: string | null,
): Promise<EmployeeMutationResult> {
  const normalizedInput = normalizeEmployeeMutationInput(input);
  const fieldErrors = validateEmployee(normalizedInput);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Please fix the highlighted employee fields.",
      fieldErrors,
    };
  }

  const tenant = await getCurrentTenant();

  const currentLookup = await supabaseAdmin
    .from("business_employees")
    .select(BUSINESS_EMPLOYEE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .maybeSingle();

  if (currentLookup.error || !currentLookup.data) {
    return {
      ok: false,
      error: currentLookup.error?.message ?? "Employee not found.",
    };
  }

  const current = mapRowToEmployeeRecord(currentLookup.data as BusinessEmployeeRow);
  const duplicateEmailId = await findDuplicateEmployeeField(
    tenant.id,
    "normalized_email",
    normalizeEmail(normalizedInput.email),
    id,
  );
  if (duplicateEmailId) {
    return {
      ok: false,
      error: "That email is already used by another employee record for this business.",
      fieldErrors: { email: "Email must be unique within the business." },
    };
  }

  const duplicateCodeId = await findDuplicateEmployeeField(
    tenant.id,
    "employee_code",
    cleanText(normalizedInput.employeeId)?.toUpperCase() ?? null,
    id,
  );
  if (duplicateCodeId) {
    return {
      ok: false,
      error: "That employee ID is already used by another employee record for this business.",
      fieldErrors: { employeeId: "Employee ID must be unique within the business." },
    };
  }

  const values = buildEmployeeWriteValues(tenant.id, normalizedInput, {
    actorUserId,
    deactivatedAt: current.deactivatedAt,
  });

  const { data, error } = await supabaseAdmin
    .from("business_employees")
    .update(values)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .select(BUSINESS_EMPLOYEE_SELECT)
    .single();

  if (error || !data) {
    const constraintError = buildConstraintError(error?.message ?? "Unable to update employee.");
    return {
      ok: false,
      error: constraintError.error,
      fieldErrors: constraintError.fieldErrors,
    };
  }

  const saved = mapRowToEmployeeRecord(data as BusinessEmployeeRow);

  await recordEntityHistory(
    supabaseAdmin,
    diffEntityFields(
      "employee",
      id,
      toEmployeeMutationInput(current),
      toEmployeeMutationInput(saved),
      [
        "employeeId",
        "firstName",
        "lastName",
        "streetAddress",
        "city",
        "state",
        "zip",
        "jobTitle",
        "phone",
        "secondPhone",
        "email",
        "dateOfBirth",
        "active",
        "status",
        "notes",
        "licenseNumber",
        "licenseState",
        "licenseClass",
        "licenseExpiration",
        "hireDate",
        "emergencyContactName",
        "emergencyContactPhone",
        "preferredContactMethod",
        "roleKey",
        "linkedUserId",
        "deactivatedAt",
        "deactivationReason",
      ],
      {
        changedByType: "admin",
        changedById: actorUserId ?? null,
        changeReason: "Employee record updated from admin",
      },
    ),
    tenant.id,
  );

  return {
    ok: true,
    employee: saved,
    message: "Employee updated.",
  };
}

export async function deactivateEmployeeForCurrentBusiness(
  id: string,
  actorUserId?: string | null,
  reason = "Soft-deactivated from the admin employees page.",
): Promise<EmployeeMutationResult> {
  return setEmployeeStatusForCurrentBusiness(id, "inactive", actorUserId, reason);
}

export async function reactivateEmployeeForCurrentBusiness(
  id: string,
  actorUserId?: string | null,
): Promise<EmployeeMutationResult> {
  return setEmployeeStatusForCurrentBusiness(id, "active", actorUserId, null);
}

async function setEmployeeStatusForCurrentBusiness(
  id: string,
  status: Extract<EmployeeStatus, "active" | "inactive">,
  actorUserId?: string | null,
  reason?: string | null,
): Promise<EmployeeMutationResult> {
  const tenant = await getCurrentTenant();
  const currentLookup = await supabaseAdmin
    .from("business_employees")
    .select(BUSINESS_EMPLOYEE_SELECT)
    .eq("id", id)
    .eq("business_id", tenant.id)
    .maybeSingle();

  if (currentLookup.error || !currentLookup.data) {
    return {
      ok: false,
      error: currentLookup.error?.message ?? "Employee not found.",
    };
  }

  const current = mapRowToEmployeeRecord(currentLookup.data as BusinessEmployeeRow);
  const nextDeactivatedAt = status === "inactive" ? new Date().toISOString() : null;

  const { data, error } = await supabaseAdmin
    .from("business_employees")
    .update({
      status,
      deactivated_at: nextDeactivatedAt,
      deactivation_reason: status === "inactive" ? reason ?? "Employee soft-deactivated by admin" : null,
      updated_by: actorUserId ?? null,
    })
    .eq("id", id)
    .eq("business_id", tenant.id)
    .select(BUSINESS_EMPLOYEE_SELECT)
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Unable to update employee status.",
    };
  }

  const saved = mapRowToEmployeeRecord(data as BusinessEmployeeRow);

  await recordEntityHistory(supabaseAdmin, [
    ...diffEntityFields(
      "employee",
      id,
      toEmployeeMutationInput(current),
      toEmployeeMutationInput(saved),
      ["active", "status", "deactivatedAt", "deactivationReason"],
      {
        changedByType: "admin",
        changedById: actorUserId ?? null,
        changeReason:
          status === "inactive" ? "Employee soft-deactivated by admin" : "Employee reactivated by admin",
      },
    ),
  ], tenant.id);

  return {
    ok: true,
    employee: saved,
    message: status === "inactive" ? "Employee moved to inactive." : "Employee reactivated.",
  };
}
