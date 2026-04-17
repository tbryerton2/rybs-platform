export type ExpenseCategory =
  | "Fuel"
  | "Vehicle maintenance"
  | "Dump fees / disposal"
  | "Payroll"
  | "Insurance"
  | "Equipment"
  | "Office / admin"
  | "Marketing"
  | "Other";

export type ExpensePaymentStatus = "Paid" | "Scheduled" | "Outstanding";
export type ExpensePaymentMethod =
  | "Card"
  | "ACH"
  | "Check"
  | "Cash"
  | "Payroll run"
  | "Other";

export type ExpenseRecord = {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  vendor: string;
  description: string;
  amountCents: number;
  paymentStatus: ExpensePaymentStatus;
  paymentMethod: ExpensePaymentMethod;
  relatedAsset: string;
  taxDeductible: boolean;
  receiptReference: string;
  notes: string;
  updatedAt: string;
};

export const expenseCategories: ExpenseCategory[] = [
  "Fuel",
  "Vehicle maintenance",
  "Dump fees / disposal",
  "Payroll",
  "Insurance",
  "Equipment",
  "Office / admin",
  "Marketing",
  "Other",
];

export const paymentStatuses: ExpensePaymentStatus[] = ["Paid", "Scheduled", "Outstanding"];
export const paymentMethods: ExpensePaymentMethod[] = ["Card", "ACH", "Check", "Cash", "Payroll run", "Other"];

export function createEmptyExpense(): ExpenseRecord {
  return {
    id: "",
    expenseDate: "",
    category: "Fuel",
    vendor: "",
    description: "",
    amountCents: 0,
    paymentStatus: "Paid",
    paymentMethod: "Card",
    relatedAsset: "",
    taxDeductible: true,
    receiptReference: "",
    notes: "",
    updatedAt: "",
  };
}

export function createMockExpenses(): ExpenseRecord[] {
  return [
    {
      id: "exp_1",
      expenseDate: "2026-04-08",
      category: "Fuel",
      vendor: "Fleet Fuel Services",
      description: "Weekly diesel top-up for route trucks",
      amountCents: 48620,
      paymentStatus: "Paid",
      paymentMethod: "Card",
      relatedAsset: "Truck 12",
      taxDeductible: true,
      receiptReference: "INV-24018",
      notes: "Included two emergency after-hours fills.",
      updatedAt: "2026-04-08T16:20:00.000Z",
    },
    {
      id: "exp_2",
      expenseDate: "2026-04-05",
      category: "Vehicle maintenance",
      vendor: "North Yard Truck Repair",
      description: "Brake service and inspection",
      amountCents: 129500,
      paymentStatus: "Outstanding",
      paymentMethod: "ACH",
      relatedAsset: "Truck 08",
      taxDeductible: true,
      receiptReference: "WO-8821",
      notes: "Payment due net 15.",
      updatedAt: "2026-04-06T10:05:00.000Z",
    },
    {
      id: "exp_3",
      expenseDate: "2026-04-03",
      category: "Dump fees / disposal",
      vendor: "County Transfer Station",
      description: "Disposal charges for mixed debris loads",
      amountCents: 73200,
      paymentStatus: "Paid",
      paymentMethod: "ACH",
      relatedAsset: "",
      taxDeductible: true,
      receiptReference: "CTS-19037",
      notes: "",
      updatedAt: "2026-04-03T19:10:00.000Z",
    },
    {
      id: "exp_4",
      expenseDate: "2026-04-01",
      category: "Payroll",
      vendor: "Weekly payroll",
      description: "Driver and yard payroll batch",
      amountCents: 428000,
      paymentStatus: "Paid",
      paymentMethod: "Payroll run",
      relatedAsset: "",
      taxDeductible: true,
      receiptReference: "PAY-2026-14",
      notes: "Includes overtime for Saturday route support.",
      updatedAt: "2026-04-01T13:42:00.000Z",
    },
  ];
}
