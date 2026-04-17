export type EmployeePreferredContactMethod = "phone" | "text" | "email";

export type EmployeeStatusTag =
  | "Driver"
  | "Lead Driver"
  | "Yard"
  | "Operations"
  | "Mechanic"
  | "Seasonal";

export type EmployeeRecord = {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
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
  notes: string;
  licenseNumber: string;
  licenseState: string;
  licenseClass: string;
  licenseExpiration: string;
  hireDate: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  preferredContactMethod: EmployeePreferredContactMethod;
  statusTag: EmployeeStatusTag | "";
  updatedAt: string;
};

export const employeeStatusTagOptions: EmployeeStatusTag[] = [
  "Driver",
  "Lead Driver",
  "Yard",
  "Operations",
  "Mechanic",
  "Seasonal",
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
    employeeId: "",
    firstName: "",
    lastName: "",
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
    notes: "",
    licenseNumber: "",
    licenseState: "",
    licenseClass: "",
    licenseExpiration: "",
    hireDate: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    preferredContactMethod: "phone",
    statusTag: "",
    updatedAt: "",
  };
}

export function createMockEmployees(): EmployeeRecord[] {
  return [
    {
      id: "emp_1",
      employeeId: "EMP-1001",
      firstName: "Marcus",
      lastName: "Hill",
      streetAddress: "1420 Cedar Run",
      city: "Syracuse",
      state: "NY",
      zip: "13208",
      jobTitle: "Lead Driver",
      phone: "3155550181",
      secondPhone: "",
      email: "marcus.hill@example.com",
      dateOfBirth: "1988-09-17",
      active: true,
      notes: "Primary roll-off route lead. Cleared for training newer drivers on yard loading flow.",
      licenseNumber: "H4589217",
      licenseState: "NY",
      licenseClass: "Class B",
      licenseExpiration: "2026-11-02",
      hireDate: "2022-03-14",
      emergencyContactName: "Dana Hill",
      emergencyContactPhone: "3155550199",
      preferredContactMethod: "text",
      statusTag: "Lead Driver",
      updatedAt: "2026-04-02T14:32:00.000Z",
    },
    {
      id: "emp_2",
      employeeId: "EMP-1002",
      firstName: "Alyssa",
      lastName: "Nguyen",
      streetAddress: "28 Palmer Ave",
      city: "Liverpool",
      state: "NY",
      zip: "13088",
      jobTitle: "Operations Coordinator",
      phone: "3155550114",
      secondPhone: "3155550115",
      email: "alyssa.nguyen@example.com",
      dateOfBirth: "1992-04-05",
      active: true,
      notes: "Handles customer handoff and same-day dispatch changes. Prefers email for non-urgent updates.",
      licenseNumber: "N6034921",
      licenseState: "NY",
      licenseClass: "Class D",
      licenseExpiration: "2027-01-18",
      hireDate: "2023-08-21",
      emergencyContactName: "Helen Nguyen",
      emergencyContactPhone: "3155550116",
      preferredContactMethod: "email",
      statusTag: "Operations",
      updatedAt: "2026-04-08T09:10:00.000Z",
    },
    {
      id: "emp_3",
      employeeId: "EMP-1003",
      firstName: "Jordan",
      lastName: "Ellis",
      streetAddress: "511 Westmoreland Dr",
      city: "Baldwinsville",
      state: "NY",
      zip: "13027",
      jobTitle: "Driver",
      phone: "3155550172",
      secondPhone: "",
      email: "jordan.ellis@example.com",
      dateOfBirth: "1996-12-11",
      active: true,
      notes: "Available for Saturday routes. Forklift certified.",
      licenseNumber: "E8842104",
      licenseState: "NY",
      licenseClass: "Class B",
      licenseExpiration: "2026-08-09",
      hireDate: "2024-02-12",
      emergencyContactName: "Maya Ellis",
      emergencyContactPhone: "3155550173",
      preferredContactMethod: "phone",
      statusTag: "Driver",
      updatedAt: "2026-03-28T16:48:00.000Z",
    },
    {
      id: "emp_4",
      employeeId: "EMP-1004",
      firstName: "Renee",
      lastName: "Porter",
      streetAddress: "77 Lakeview Ct",
      city: "Clay",
      state: "NY",
      zip: "13041",
      jobTitle: "Yard Associate",
      phone: "3155550137",
      secondPhone: "",
      email: "renee.porter@example.com",
      dateOfBirth: "1985-06-29",
      active: false,
      notes: "Currently inactive. Keep record for rehire review during peak season.",
      licenseNumber: "P7218401",
      licenseState: "NY",
      licenseClass: "Class D",
      licenseExpiration: "2026-05-30",
      hireDate: "2021-05-03",
      emergencyContactName: "Chris Porter",
      emergencyContactPhone: "3155550138",
      preferredContactMethod: "phone",
      statusTag: "Seasonal",
      updatedAt: "2026-02-19T11:05:00.000Z",
    },
  ];
}
