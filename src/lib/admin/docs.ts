// src/lib/admin/docs.ts

export type DocSection = {
  id?: string;
  heading: string;
  lead?: string;
  paragraphs?: string[];
  bullets?: string[];
  callout?: {
    tone?: "info" | "warning" | "success";
    title: string;
    body: string;
  };
};

export type DocSummaryCard = {
  label: string;
  value: string;
  description: string;
};

export type DocComparisonTable = {
  columns: string[];
  rows: Array<{
    label: string;
    values: string[];
  }>;
};

export type DocScenario = {
  title: string;
  summary: string;
  guidance: string;
};

export type DocFaqItem = {
  question: string;
  answer: string;
};

export type DocChecklist = {
  title: string;
  items: string[];
};

export type DocHighlightCallout = {
  label: string;
  title: string;
  body: string;
};

export type DocEntry = {
  slug: string;
  title: string;
  description: string;
  badge?: string;
  lastReviewed?: string;
  featured?: boolean;
  quickAnswer?: DocHighlightCallout;
  summaryCards?: DocSummaryCard[];
  comparisonTable?: DocComparisonTable;
  relationshipDiagram?: {
    customerAccount: string;
    bookingRelationship: string;
    bookingDetails: string[];
  };
  scenarios?: DocScenario[];
  faq?: DocFaqItem[];
  checklist?: DocChecklist;
  sections: DocSection[];
};

export const docs: DocEntry[] = [
  {
    slug: "customer-booking-identity",
    title: "Identity Model & Portal Access",
    description:
      "Operational guide for how customer accounts, booking references, historical snapshots, portal access, and staff search work together.",
    badge: "Operations Manual",
    lastReviewed: "2026-03-22",
    featured: true,
    quickAnswer: {
      label: "Quick answer",
      title: "Why does a booking show an old email while the customer account shows a new one?",
      body:
        "The booking preserves the historical details entered at the time of booking. The customer account shows the current linked account information. This is expected behavior, not a bug.",
    },
    summaryCards: [
      {
        label: "Customer identity",
        value: "Email + UUID",
        description:
          "Staff and customers recognize the account by email, while the platform keeps a stable internal customer UUID behind the scenes.",
      },
      {
        label: "Booking identity",
        value: "BK-###### + UUID",
        description:
          "Customers should use the booking reference. Internal UUIDs exist for system integrity, staff workflows, and integrations.",
      },
      {
        label: "Historical snapshots vs current account",
        value: "Old + new details can both appear",
        description:
          "Bookings keep the contact details entered at the time of booking, while the linked customer account can show newer information later.",
      },
      {
        label: "How staff should search",
        value: "Booking reference, email, phone, or address",
        description:
          "Use the booking ref first when you have it. If account details changed, older booking details and service address can still help find the right record.",
      },
    ],
    relationshipDiagram: {
      customerAccount: "One customer account",
      bookingRelationship: "can be linked to many bookings",
      bookingDetails: [
        "Customer-facing booking ref",
        "Internal booking UUID",
        "Booked-with snapshot fields",
        "Service location for that job",
      ],
    },
    comparisonTable: {
      columns: ["Used by staff/customers as", "Stable over time?", "What it is for"],
      rows: [
        {
          label: "Customer account",
          values: [
            "Email for day-to-day account recognition, UUID internally",
            "UUID stays stable even if email changes",
            "Represents the single portal account and links all bookings for that customer",
          ],
        },
        {
          label: "Booking",
          values: [
            "BK-###### for customer-facing reference, UUID internally",
            "Yes",
            "Identifies one rental/job without exposing internal system IDs to customers",
          ],
        },
        {
          label: "Booked-with snapshot",
          values: [
            "Historical name, email, and phone captured at booking time",
            "Yes, by design",
            "Preserves what was originally entered when the booking was created",
          ],
        },
        {
          label: "Portal access",
          values: [
            "Current customer account email and portal status",
            "Email can change; access status can change",
            "Controls sign-in and access links without changing operational records",
          ],
        },
      ],
    },
    sections: [
      {
        id: "why-this-matters",
        heading: "Why this matters",
        paragraphs: [
          "When staff understand the identity model, it becomes much easier to explain what a customer is seeing, confirm the right record quickly, and avoid treating expected system behavior like a data issue.",
          "This guide explains how the platform separates customer identity, booking identity, historical booking snapshots, and portal access so support and operations can work confidently from the admin system.",
        ],
      },
      {
        id: "identity-model-at-a-glance",
        heading: "Identity model at a glance",
        bullets: [
          "Customer-facing customer identity is the email address on the account.",
          "Internal customer identity is a UUID that does not change when the customer email changes later.",
          "One portal account maps to one customer.",
          "One customer can have many bookings.",
          "Customer-facing booking identity is the booking reference, such as BK-482731.",
          "Internal booking identity is a UUID and should stay internal to staff workflows, data integrity, and integrations.",
        ],
        callout: {
          tone: "info",
          title: "Plain-language rule",
          body: "Customers should recognize themselves by account email and booking reference. Staff may see UUIDs in the admin system, but UUIDs are not the customer-facing identifiers.",
        },
      },
      {
        id: "customer-identity-model",
        heading: "Customer identity model",
        paragraphs: [
          "A customer account is the long-lived identity record for a person or company in the system. That account can own many bookings over time.",
          "From a business and support perspective, the customer is recognized by their current account email. Internally, the platform uses a UUID so the same customer record can remain stable even if contact details are updated later.",
        ],
        bullets: [
          "One portal account = one customer record.",
          "A customer can have many bookings tied to the same internal customer UUID.",
          "Changing a customer email updates the account identity used for portal access, but it does not create a brand-new customer.",
          "The admin customer record is the place to review the current linked account identity.",
        ],
      },
      {
        id: "booking-identity-model",
        heading: "Booking identity model",
        paragraphs: [
          "Each booking represents one rental/job. Customers should identify a booking by the booking reference, not by any internal database ID.",
        ],
        bullets: [
          "Customer-facing booking identity = booking ref in the BK-###### format.",
          "Internal booking identity = UUID.",
          "Use the booking ref when speaking with customers, confirming a job, or asking a customer to locate a rental.",
          "Use internal UUIDs only inside the admin/product context where system-level precision is needed.",
          "Booking refs are easier for customers to read back on the phone and safer to expose in emails or portal views than raw UUIDs.",
        ],
      },
      {
        id: "snapshot-vs-current-account-identity",
        heading: "Snapshot vs current account identity",
        paragraphs: [
          "Bookings keep historical details from the moment they were created. This includes booked-with fields such as name, email, and phone.",
          "The linked customer account can change later. Because of that, a booking detail page may correctly show both the original booked-with snapshot and the current linked customer/account identity.",
        ],
        bullets: [
          "Booked-with snapshot identity answers: what details were entered when the booking was made?",
          "Current linked customer/account identity answers: what account is this booking linked to now?",
          "Service location answers: where is this job being performed?",
          "If the booked-with email and current account email differ, that is expected when account details changed after booking.",
        ],
        callout: {
          tone: "success",
          title: "Expected behavior",
          body: "If a booking shows an older email while the customer account shows a newer email, treat that as historical accuracy, not as a bug.",
        },
      },
      {
        id: "customer-email-changes",
        heading: "Customer email changes",
        paragraphs: [
          "Updating a customer's email does not create a new customer record. The same internal customer UUID remains in place, and linked bookings stay attached to that customer.",
          "This lets the business maintain continuity for reporting, repeat business, and portal access while still preserving historical booking snapshots from earlier transactions.",
        ],
        bullets: [
          "Same customer stays linked to the same internal UUID.",
          "Existing bookings remain attached to that customer.",
          "Entity history records the account change.",
          "Older bookings can continue to show their original snapshot email and phone from the time of booking.",
        ],
      },
      {
        id: "portal-access-and-deactivation",
        heading: "Portal access and deactivation",
        paragraphs: [
          "Portal access is tied to the customer account and current account email. It is not tied to an individual booking.",
          "If access needs to be blocked, staff can deactivate portal access without deleting customers or bookings.",
        ],
        bullets: [
          "Deactivation is soft only.",
          "Deactivation blocks sign-in and access links.",
          "Deactivation does not remove bookings, customer records, or operational history.",
          "Staff may deactivate access when a customer requests it, when access was granted to the wrong email, or when the business needs to pause portal usage while keeping records intact.",
        ],
      },
      {
        id: "how-staff-should-search",
        heading: "How staff should search",
        lead: "Use the admin bookings search based on what the customer actually knows.",
        bullets: [
          "Booking ref: best option when the customer can read back BK-######.",
          "Current account email: use when the customer is referring to their active portal/account login.",
          "Booked-with email or contact name: use when the current account changed after booking or someone else placed the order.",
          "Phone: helpful when the customer only has the phone number used on the job.",
          "Service address: useful for repeat customers with multiple bookings at different sites.",
        ],
        callout: {
          tone: "warning",
          title: "Support workflow",
          body: "If a search by current account email does not immediately explain the booking, check the booked-with snapshot and service address next. Older booking details may not match the latest account identity exactly.",
        },
      },
      {
        id: "key-rules-to-remember",
        heading: "Key rules to remember",
        bullets: [
          "Email is the customer-facing account identity; UUID is the internal customer identity.",
          "Booking ref is the customer-facing booking identity; UUID is the internal booking identity.",
          "One customer can have many bookings.",
          "A booking keeps its own historical snapshot fields.",
          "Portal access can be deactivated without deleting records.",
          "A mismatch between booked-with details and current account details can be expected and valid.",
        ],
      },
    ],
    scenarios: [
      {
        title: "Same customer, two different addresses",
        summary:
          "A repeat customer books once for home and later for a job site.",
        guidance:
          "Keep both bookings linked to the same customer account if they belong to the same customer. Each booking should still keep its own service location snapshot for that job.",
      },
      {
        title: "Same email, different booking contact name",
        summary:
          "An office manager uses the company email, but each job may list a different on-site contact.",
        guidance:
          "Treat the customer account email as the account identity and the booking contact as the operational snapshot for that specific rental.",
      },
      {
        title: "Customer changes email after booking",
        summary:
          "The customer updates their account email after one or more bookings already exist.",
        guidance:
          "The customer remains the same internal customer. Linked bookings stay attached, while older booked-with snapshot values can continue to show the original email.",
      },
      {
        title: "Customer gives booking ref on the phone",
        summary:
          "The caller has BK-###### available and wants help quickly.",
        guidance:
          "Search the booking ref first. It is the fastest and most reliable path to the exact job the customer is talking about.",
      },
      {
        title: "Booking shows old email but customer account shows new email",
        summary:
          "Staff sees different emails on the same booking detail page and assumes something is broken.",
        guidance:
          "Confirm which value is the booked-with snapshot and which value is the current linked account. This difference is expected after account updates.",
      },
      {
        title: "Portal access is disabled but records remain",
        summary:
          "A customer should no longer be able to sign in, but the business still needs their service history.",
        guidance:
          "Deactivate portal access. The customer and all linked bookings remain in the system for operations, reporting, and support history.",
      },
    ],
    faq: [
      {
        question: "Why do we use UUIDs if staff and customers do not talk about them?",
        answer:
          "UUIDs give the system a stable internal identifier that does not depend on readable fields like email or booking ref. That stability protects links between records, especially when customer details change later.",
      },
      {
        question: "Does changing a customer email create a second customer?",
        answer:
          "No. The customer remains the same internal record. The current account email updates, while linked bookings stay attached to the same customer UUID.",
      },
      {
        question: "Why can a booking show one email while the customer account shows another?",
        answer:
          "Because the booking keeps a historical booked-with snapshot from the time the order was placed. The customer account shows the current linked account identity.",
      },
      {
        question: "Should staff ever give a customer an internal UUID?",
        answer:
          "No. Customers should be given the booking ref for a rental and their account email for portal/account-related confirmation.",
      },
      {
        question: "Does portal deactivation delete anything?",
        answer:
          "No. It only blocks sign-in/access. Operational records, linked bookings, and historical data remain intact.",
      },
      {
        question: "What should staff search first during support?",
        answer:
          "Start with booking ref when available. Otherwise search the most reliable detail the customer can provide: current account email, booked-with email, name, phone, or service address.",
      },
    ],
    checklist: {
      title: "Staff checklist",
      items: [
        "Ask whether the customer has the booking ref before searching.",
        "Confirm whether you are looking at the current account identity or the booked-with snapshot.",
        "Check the service address when a customer has multiple bookings.",
        "Use booking ref and account email in customer conversations, not UUIDs.",
        "Treat portal deactivation as access control only, not record deletion.",
      ],
    },
  },
  {
    slug: "how-booking-works",
    title: "How Booking Works",
    description:
      "Overview of the booking lifecycle from customer request through pickup.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "The booking system is the operational backbone of the business. Every dumpster rental should move through a clear lifecycle so the team knows what has been booked, what must be delivered, what is currently on-site, and what has been completed.",
          "Staff should treat the booking record as the source of truth for customer details, service address, dates, pricing, notes, and current job status.",
        ],
      },
      {
        heading: "Typical booking lifecycle",
        bullets: [
          "Customer submits a booking through the website.",
          "The booking appears in the admin system.",
          "Staff reviews job details and confirms scheduling.",
          "The job is prepared for delivery.",
          "Dumpster is delivered to the customer site.",
          "Dumpster remains on-site until pickup is requested or scheduled.",
          "Dumpster is picked up and the booking is marked complete.",
        ],
      },
      {
        heading: "What staff should verify on every new booking",
        bullets: [
          "Customer name, phone number, and email",
          "Service address and ZIP code",
          "Delivery date",
          "Pickup details if already selected",
          "Dumpster size / product selected",
          "Pricing and any overrides",
          "Special notes, access instructions, or placement guidance",
        ],
      },
      {
        heading: "Operational rule",
        paragraphs: [
          "Before a booking is acted on in the field, the office should make sure the record is complete enough that a driver can execute the job without needing to guess.",
        ],
      },
    ],
  },
  {
    slug: "booking-statuses",
    title: "Booking Statuses",
    description:
      "Definitions for each booking status and how staff should interpret them.",
    sections: [
      {
        heading: "Why statuses matter",
        paragraphs: [
          "Booking statuses allow the office and field team to quickly understand where each job stands. Staff should use statuses consistently so the schedule, dashboard, financials, and customer history all reflect reality.",
        ],
      },
      {
        heading: "Confirmed",
        paragraphs: [
          "Confirmed means the booking exists and has been accepted, but it may not yet be fully scheduled for operational execution.",
        ],
        bullets: [
          "Job is active",
          "Delivery still pending",
          "May still need dispatch planning",
        ],
      },
      {
        heading: "Scheduled",
        paragraphs: [
          "Scheduled means the job has been operationally planned and is ready for dispatch based on the assigned delivery date.",
        ],
        bullets: [
          "Delivery still pending",
          "Should be reviewed on the dispatch board",
          "Driver execution should be straightforward",
        ],
      },
      {
        heading: "Delivered",
        paragraphs: [
          "Delivered means the dumpster is currently on the customer site. This is an active in-progress job.",
        ],
        bullets: [
          "Job is live in the field",
          "Customer currently has the dumpster",
          "Monitor for pickup request or scheduled pickup date",
        ],
      },
      {
        heading: "Picked Up",
        paragraphs: [
          "Picked Up means the dumpster has been removed from the site and the job is complete.",
        ],
        bullets: [
          "Operational work is finished",
          "Should count as completed business activity",
          "Financial reporting should treat this as a completed job",
        ],
      },
      {
        heading: "Cancelled",
        paragraphs: [
          "Cancelled means the booking is inactive and should no longer be treated as work to perform.",
        ],
        bullets: [
          "Do not dispatch",
          "Do not count as active operational work",
          "Retain for history and reporting where appropriate",
        ],
      },
      {
        heading: "Status change rules",
        bullets: [
          "Only move a booking forward when the real-world job state has changed.",
          "Do not mark a job as delivered until the dumpster is actually on-site.",
          "Do not mark a job as picked up until the dumpster has actually been removed.",
          "Use cancelled only when the job will not occur.",
        ],
      },
    ],
  },
  {
    slug: "dispatch-schedule-workflow",
    title: "Dispatch / Schedule Workflow",
    description:
      "How to use the schedule page to plan deliveries and pickups each day.",
    sections: [
      {
        heading: "Purpose of the schedule page",
        paragraphs: [
          "The schedule page is used to organize daily field operations. It helps the business decide what must be delivered, what needs pickup attention, and what jobs should be prioritized first.",
        ],
      },
      {
        heading: "Daily workflow",
        bullets: [
          "Review upcoming deliveries for the day and next few days.",
          "Review open pickup requests.",
          "Review scheduled pickups.",
          "Check notes for site access issues, timing constraints, or customer requests.",
          "Sequence work so drivers can complete the route efficiently.",
        ],
      },
      {
        heading: "How to prioritize work",
        bullets: [
          "Time-sensitive deliveries first",
          "Confirmed pickup requests that need fast response",
          "Scheduled pickups due today or overdue",
          "Jobs with customer notes that may require extra coordination",
        ],
      },
      {
        heading: "Handling pickup requests",
        paragraphs: [
          "When a customer requests pickup, staff should review the request promptly and convert it into an operationally planned pickup when possible.",
        ],
        bullets: [
          "Confirm address and dumpster location",
          "Check whether the request can be completed on the next route",
          "Update job details if needed",
          "Make sure the booking remains visible to dispatch until completed",
        ],
      },
      {
        heading: "Operational rule",
        paragraphs: [
          "The dispatch board should reflect the real work queue. If something is still on the board, the team should assume action is still required.",
        ],
      },
    ],
  },
  {
    slug: "pricing-rules",
    title: "Pricing Rules",
    description:
      "How pricing works, including base pricing, discounts, overages, and ZIP-based overrides.",
    sections: [
      {
        heading: "Pricing philosophy",
        paragraphs: [
          "Pricing should be consistent, easy for staff to explain, and flexible enough to account for service area differences and job-specific complexity.",
        ],
      },
      {
        heading: "Core pricing components",
        bullets: [
          "Base rental price",
          "Scheduled pickup discount if applicable",
          "Extra day charges",
          "Weight or dump overage charges if applicable",
          "ZIP-specific pricing overrides",
        ],
      },
      {
        heading: "Base pricing",
        paragraphs: [
          "Base pricing is the starting point for the job. It should represent the standard rental terms for a typical booking within the normal service area.",
        ],
      },
      {
        heading: "Scheduled pickup discount",
        paragraphs: [
          "If the business offers a discount when the customer selects a pickup date in advance, staff should apply that rule consistently. The purpose is to reduce operational uncertainty and improve route planning.",
        ],
      },
      {
        heading: "Extra day charges",
        paragraphs: [
          "Extra day charges apply when the dumpster remains on-site beyond the included rental period.",
        ],
        bullets: [
          "Use the configured pricing settings as the source of truth",
          "Do not guess or manually invent charges unless management approves",
          "Document exceptions in notes",
        ],
      },
      {
        heading: "Overage charges",
        paragraphs: [
          "If the business uses weight-based or disposal-based overages, those charges should only be applied according to documented business rules.",
        ],
        bullets: [
          "Use clear thresholds",
          "Explain charges consistently to customers",
          "Capture exceptions or manager approvals in notes",
        ],
      },
      {
        heading: "ZIP overrides",
        paragraphs: [
          "Some ZIP codes may require custom pricing due to travel distance, demand, or local operating constraints. When a ZIP override exists, it should take precedence over the default pricing model.",
        ],
      },
      {
        heading: "Operational rule",
        paragraphs: [
          "Pricing settings should be maintained centrally. Staff should avoid one-off pricing changes unless explicitly approved.",
        ],
      },
    ],
  },
  {
    slug: "service-area-zips",
    title: "Service Area (ZIPs)",
    description:
      "How ZIP code settings control where the business operates and how local pricing is managed.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "The ZIP system controls where the business offers service and allows the company to customize settings by area.",
        ],
      },
      {
        heading: "What ZIP settings are used for",
        bullets: [
          "Enable or disable service in specific ZIP codes",
          "Store local pricing overrides",
          "Track area-level business activity",
          "Support expansion decisions",
        ],
      },
      {
        heading: "Active vs inactive ZIPs",
        paragraphs: [
          "An active ZIP is a serviceable area. An inactive ZIP should not be treated as part of the regular operating footprint.",
        ],
        bullets: [
          "Use active ZIPs for normal booking flow",
          "Disable ZIPs when the business does not want new jobs there",
          "Review inactive ZIPs before re-opening service",
        ],
      },
      {
        heading: "When to use pricing overrides",
        bullets: [
          "Longer-distance routes",
          "Areas with unusual disposal cost",
          "Areas with high demand",
          "Areas that need promotional pricing",
        ],
      },
      {
        heading: "Operational rule",
        paragraphs: [
          "ZIP settings affect both customer experience and profit margins. Changes should be made intentionally and reviewed when expanding or tightening the service area.",
        ],
      },
    ],
  },
  {
    slug: "customer-management",
    title: "Customer Management",
    description:
      "How to use the customer section as a lightweight CRM for repeat business and service history.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "The customer section gives staff a simple CRM view of who the business serves, how often they book, and what their recent history looks like.",
        ],
      },
      {
        heading: "What staff should use this section for",
        bullets: [
          "Find a customer quickly",
          "Review past bookings",
          "Access latest job details",
          "Contact the customer if needed",
          "Spot repeat customers and good retention opportunities",
        ],
      },
      {
        heading: "What to verify when viewing a customer",
        bullets: [
          "Correct contact information",
          "Most recent booking status",
          "History of completed jobs",
          "Any notes or recurring service patterns",
        ],
      },
      {
        heading: "Operational rule",
        paragraphs: [
          "Customer records should help staff provide consistent service. If contact details are wrong or missing, correct them when reliable information is available.",
        ],
      },
    ],
  },
  {
    slug: "financial-tracking",
    title: "Financial Tracking",
    description:
      "How to interpret the financials page and use it to understand business performance.",
    sections: [
      {
        heading: "Purpose",
        paragraphs: [
          "The financials page helps the business understand revenue trends, job value, and overall performance, even before deeper payment integrations are added.",
        ],
      },
      {
        heading: "What staff or owners should look for",
        bullets: [
          "Revenue trends over time",
          "Number of completed jobs",
          "Average revenue per job",
          "High-value service areas or customer segments",
          "Operational patterns that affect profitability",
        ],
      },
      {
        heading: "How to interpret the data",
        paragraphs: [
          "Financial tracking is only as reliable as the underlying booking records. If statuses, dates, or pricing are wrong, financial reporting will also be wrong.",
        ],
      },
      {
        heading: "Operational rule",
        bullets: [
          "Keep statuses accurate",
          "Keep pricing rules current",
          "Document exceptions clearly",
          "Review unusual spikes or dips before acting on them",
        ],
      },
    ],
  },
  {
    slug: "common-issues-troubleshooting",
    title: "Common Issues / Troubleshooting",
    description:
      "Practical guidance for handling common operational and admin problems.",
    sections: [
      {
        heading: "Booking appears wrong",
        bullets: [
          "Confirm customer details",
          "Check the current status",
          "Review delivery and pickup dates",
          "Look for notes or pricing overrides",
          "Verify the service ZIP is active",
        ],
      },
      {
        heading: "Job is missing from schedule expectations",
        bullets: [
          "Confirm the booking status is still active",
          "Check whether the date is correct",
          "Check if the job was cancelled or completed",
          "Review dispatch filters or grouping logic if applicable",
        ],
      },
      {
        heading: "Customer says pricing is different than expected",
        bullets: [
          "Review pricing settings",
          "Check for ZIP overrides",
          "Check whether extra days or overages apply",
          "Review notes for custom approval or exception handling",
        ],
      },
      {
        heading: "Pickup has not happened yet",
        bullets: [
          "Check whether the pickup was only requested or fully scheduled",
          "Review route priority",
          "Look for operational notes or access issues",
          "Communicate clearly with the customer if timing changes",
        ],
      },
      {
        heading: "General troubleshooting rule",
        paragraphs: [
          "Start with the booking record, because it usually explains the issue. When the record is incomplete or inconsistent, correct the source data first rather than relying on memory or side conversations.",
        ],
      },
    ],
  },
];

export function getDocBySlug(slug: string) {
  return docs.find((doc) => doc.slug === slug);
}
