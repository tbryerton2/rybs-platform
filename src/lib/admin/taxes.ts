export type TaxCheckpointStatus = "On track" | "Due soon" | "Needs review";
export type EmployeeTaxDocumentStatus = "Complete" | "Missing info" | "Pending update";

export type BusinessTaxProfile = {
  businessTaxId: string;
  filingEntity: string;
  salesTaxStatus: string;
  payrollTaxStatus: string;
  complianceNotes: string;
  updatedAt: string;
};

export type TaxCheckpoint = {
  id: string;
  label: string;
  dueDate: string;
  owner: string;
  status: TaxCheckpointStatus;
  notes: string;
};

export type EmployeeTaxRecord = {
  id: string;
  employeeName: string;
  role: string;
  withholdingFormStatus: EmployeeTaxDocumentStatus;
  stateSetupStatus: EmployeeTaxDocumentStatus;
  yearEndDeliveryStatus: EmployeeTaxDocumentStatus;
  notes: string;
};

export function createMockTaxProfile(): BusinessTaxProfile {
  return {
    businessTaxId: "Pending secure vault link",
    filingEntity: "Domestic LLC",
    salesTaxStatus: "Configured for local review before quarterly filing",
    payrollTaxStatus: "Tracked through payroll provider reconciliation",
    complianceNotes:
      "Use this page as the admin control point for status tracking, reminders, and document completeness. Do not store full tax filings here.",
    updatedAt: "2026-04-07T15:05:00.000Z",
  };
}

export function createMockTaxCheckpoints(): TaxCheckpoint[] {
  return [
    {
      id: "tax_1",
      label: "Quarterly sales tax review",
      dueDate: "2026-04-20",
      owner: "Owner",
      status: "Due soon",
      notes: "Confirm taxable booking totals and exempt adjustments.",
    },
    {
      id: "tax_2",
      label: "Payroll tax deposit reconciliation",
      dueDate: "2026-04-18",
      owner: "Bookkeeper",
      status: "On track",
      notes: "Match payroll provider totals to bank withdrawals.",
    },
    {
      id: "tax_3",
      label: "Entity filing package prep",
      dueDate: "2026-05-15",
      owner: "CPA",
      status: "Needs review",
      notes: "Need updated disposal fee categorization before handoff.",
    },
  ];
}

export function createMockEmployeeTaxRecords(): EmployeeTaxRecord[] {
  return [
    {
      id: "etr_1",
      employeeName: "Marcus Hill",
      role: "Lead Driver",
      withholdingFormStatus: "Complete",
      stateSetupStatus: "Complete",
      yearEndDeliveryStatus: "Complete",
      notes: "No follow-up needed.",
    },
    {
      id: "etr_2",
      employeeName: "Alyssa Nguyen",
      role: "Operations Coordinator",
      withholdingFormStatus: "Complete",
      stateSetupStatus: "Pending update",
      yearEndDeliveryStatus: "Complete",
      notes: "Review residency update before next payroll run.",
    },
    {
      id: "etr_3",
      employeeName: "Jordan Ellis",
      role: "Driver",
      withholdingFormStatus: "Missing info",
      stateSetupStatus: "Complete",
      yearEndDeliveryStatus: "Pending update",
      notes: "Waiting on signed state withholding form.",
    },
  ];
}
