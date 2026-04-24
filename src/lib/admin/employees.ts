export type EmployeePreferredContactMethod = "phone" | "text" | "email";
export type EmployeeStatus = "active" | "inactive" | "invited";
export type EmployeeRoleKey =
  | "driver"
  | "lead_driver"
  | "yard"
  | "operations"
  | "mechanic"
  | "seasonal";

export type EmployeeRecord = {
  id: string;
  businessId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  jobTitle: string;
  phone: string;
  secondPhone: string;
  email: string;
  dateOfBirth: string;
  active: boolean;
  status: EmployeeStatus;
  notes: string;
  licenseNumber: string;
  licenseState: string;
  licenseClass: string;
  licenseExpiration: string;
  hireDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredContactMethod: EmployeePreferredContactMethod;
  roleKey: EmployeeRoleKey | "";
  linkedUserId: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type EmployeeMutationInput = Omit<
  EmployeeRecord,
  "id" | "businessId" | "fullName" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

export type EmployeeFormErrors = Partial<Record<keyof EmployeeMutationInput, string>>;

export const EMPLOYEE_CODE_MAX_LENGTH = 32;
export const EMPLOYEE_NAME_MAX_LENGTH = 80;
export const EMPLOYEE_ADDRESS_MAX_LENGTH = 160;
export const EMPLOYEE_CITY_MAX_LENGTH = 80;
export const EMPLOYEE_TITLE_MAX_LENGTH = 80;
export const EMPLOYEE_NOTES_MAX_LENGTH = 1000;
export const EMPLOYEE_LICENSE_MAX_LENGTH = 40;
export const EMPLOYEE_EMAIL_MAX_LENGTH = 160;

export const employeeRoleOptions: Array<{
  value: EmployeeRoleKey;
  label: string;
}> = [
  { value: "driver", label: "Driver" },
  { value: "lead_driver", label: "Lead Driver" },
  { value: "yard", label: "Yard" },
  { value: "operations", label: "Operations" },
  { value: "mechanic", label: "Mechanic" },
  { value: "seasonal", label: "Seasonal" },
];

export const preferredContactMethodOptions: Array<{
  value: EmployeePreferredContactMethod;
  label: string;
}> = [
  { value: "phone", label: "Phone" },
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
];

export function createEmptyEmployee(): EmployeeRecord {
  return {
    id: "",
    businessId: "",
    employeeId: "",
    firstName: "",
    lastName: "",
    fullName: "",
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    jobTitle: "",
    phone: "",
    secondPhone: "",
    email: "",
    dateOfBirth: "",
    active: true,
    status: "active",
    notes: "",
    licenseNumber: "",
    licenseState: "",
    licenseClass: "",
    licenseExpiration: "",
    hireDate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    preferredContactMethod: "phone",
    roleKey: "",
    linkedUserId: null,
    deactivatedAt: null,
    deactivationReason: null,
    createdAt: "",
    updatedAt: "",
    createdBy: null,
    updatedBy: null,
  };
}

export function normalizePhoneInput(value: string) {
  return value.replace(/[^\d()+\-\s]/g, "");
}

export function normalizeZipInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 5);
}

export function normalizeStateInput(value: string) {
  return value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
}

export function normalizeEmployeeCodeInput(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, EMPLOYEE_CODE_MAX_LENGTH);
}

export function normalizeEmailInput(value: string) {
  return value.trim().toLowerCase().slice(0, EMPLOYEE_EMAIL_MAX_LENGTH);
}

function cleanText(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

function normalizeDateInput(value: string) {
  return value.trim();
}

function parseDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function normalizeEmployeeMutationInput(employee: EmployeeMutationInput): EmployeeMutationInput {
  return {
    ...employee,
    employeeId: normalizeEmployeeCodeInput(employee.employeeId),
    firstName: cleanText(employee.firstName, EMPLOYEE_NAME_MAX_LENGTH),
    lastName: cleanText(employee.lastName, EMPLOYEE_NAME_MAX_LENGTH),
    streetAddress: cleanText(employee.streetAddress, EMPLOYEE_ADDRESS_MAX_LENGTH),
    city: cleanText(employee.city, EMPLOYEE_CITY_MAX_LENGTH),
    state: normalizeStateInput(employee.state),
    zip: normalizeZipInput(employee.zip),
    jobTitle: cleanText(employee.jobTitle, EMPLOYEE_TITLE_MAX_LENGTH),
    phone: normalizePhoneInput(employee.phone),
    secondPhone: normalizePhoneInput(employee.secondPhone),
    email: normalizeEmailInput(employee.email),
    dateOfBirth: normalizeDateInput(employee.dateOfBirth),
    notes: employee.notes.trim().slice(0, EMPLOYEE_NOTES_MAX_LENGTH),
    licenseNumber: cleanText(employee.licenseNumber, EMPLOYEE_LICENSE_MAX_LENGTH).toUpperCase(),
    licenseState: normalizeStateInput(employee.licenseState),
    licenseClass: cleanText(employee.licenseClass, EMPLOYEE_LICENSE_MAX_LENGTH),
    licenseExpiration: normalizeDateInput(employee.licenseExpiration),
    hireDate: normalizeDateInput(employee.hireDate),
    emergencyContactName: cleanText(employee.emergencyContactName, EMPLOYEE_NAME_MAX_LENGTH),
    emergencyContactPhone: normalizePhoneInput(employee.emergencyContactPhone),
    deactivationReason: employee.deactivationReason?.trim() || null,
    linkedUserId: employee.linkedUserId?.trim() || null,
  };
}

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value || "—";
}

export function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

export function formatTimestamp(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function getEmployeeRoleLabel(roleKey: EmployeeRoleKey | "") {
  return employeeRoleOptions.find((option) => option.value === roleKey)?.label ?? "—";
}

export function toEmployeeMutationInput(employee: EmployeeRecord): EmployeeMutationInput {
  return {
    employeeId: employee.employeeId,
    firstName: employee.firstName,
    lastName: employee.lastName,
    streetAddress: employee.streetAddress,
    city: employee.city,
    state: employee.state,
    zip: employee.zip,
    jobTitle: employee.jobTitle,
    phone: employee.phone,
    secondPhone: employee.secondPhone,
    email: employee.email,
    dateOfBirth: employee.dateOfBirth,
    active: employee.active,
    status: employee.status,
    notes: employee.notes,
    licenseNumber: employee.licenseNumber,
    licenseState: employee.licenseState,
    licenseClass: employee.licenseClass,
    licenseExpiration: employee.licenseExpiration,
    hireDate: employee.hireDate,
    emergencyContactName: employee.emergencyContactName,
    emergencyContactPhone: employee.emergencyContactPhone,
    preferredContactMethod: employee.preferredContactMethod,
    roleKey: employee.roleKey,
    linkedUserId: employee.linkedUserId,
    deactivatedAt: employee.deactivatedAt,
    deactivationReason: employee.deactivationReason,
  };
}

export function validateEmployee(employee: EmployeeMutationInput) {
  const normalized = normalizeEmployeeMutationInput(employee);
  const errors: EmployeeFormErrors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneDigits = normalized.phone.replace(/\D/g, "");
  const secondPhoneDigits = normalized.secondPhone.replace(/\D/g, "");
  const emergencyPhoneDigits = normalized.emergencyContactPhone.replace(/\D/g, "");
  const birthDate = parseDateValue(normalized.dateOfBirth);
  const hireDate = parseDateValue(normalized.hireDate);
  const licenseExpiration = parseDateValue(normalized.licenseExpiration);
  const today = new Date();

  if (!normalized.firstName) errors.firstName = "First name is required.";
  if (!normalized.lastName) errors.lastName = "Last name is required.";
  if (!normalized.employeeId) {
    errors.employeeId = "Employee ID is required.";
  } else if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(normalized.employeeId)) {
    errors.employeeId = "Use letters, numbers, and hyphens only.";
  }
  if (!normalized.streetAddress) errors.streetAddress = "Street address is required.";
  if (!normalized.city) errors.city = "City is required.";
  if (!normalized.state) errors.state = "State is required.";
  if (normalized.state.length !== 2) errors.state = "Use a 2-letter state code.";
  if (normalized.zip.length !== 5) errors.zip = "ZIP must be 5 digits.";
  if (!normalized.jobTitle) errors.jobTitle = "Job title is required.";
  if (phoneDigits.length !== 10) errors.phone = "Phone must be 10 digits.";
  if (normalized.secondPhone && secondPhoneDigits.length !== 10) {
    errors.secondPhone = "Second phone must be 10 digits.";
  }
  if (!normalized.email) {
    errors.email = "Email is required.";
  } else if (!emailPattern.test(normalized.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!normalized.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else if (!birthDate) {
    errors.dateOfBirth = "Enter a valid date of birth.";
  } else if (birthDate > today) {
    errors.dateOfBirth = "Date of birth cannot be in the future.";
  }
  if (!normalized.hireDate) {
    errors.hireDate = "Hire date is required.";
  } else if (!hireDate) {
    errors.hireDate = "Enter a valid hire date.";
  }
  if (birthDate && hireDate && hireDate < birthDate) {
    errors.hireDate = "Hire date cannot be earlier than date of birth.";
  }
  if (!normalized.licenseNumber) errors.licenseNumber = "License number is required.";
  if (!normalized.licenseState) errors.licenseState = "License state is required.";
  if (normalized.licenseState.length !== 2) errors.licenseState = "Use a 2-letter state code.";
  if (!normalized.licenseClass) errors.licenseClass = "License class is required.";
  if (!normalized.licenseExpiration) {
    errors.licenseExpiration = "License expiration is required.";
  } else if (!licenseExpiration) {
    errors.licenseExpiration = "Enter a valid expiration date.";
  }
  if (!normalized.emergencyContactName) {
    errors.emergencyContactName = "Emergency contact name is required.";
  }
  if (emergencyPhoneDigits.length !== 10) {
    errors.emergencyContactPhone = "Emergency contact phone must be 10 digits.";
  }

  return errors;
}
