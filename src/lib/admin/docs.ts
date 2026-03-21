// src/lib/admin/docs.ts

export type DocSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type DocEntry = {
  slug: string;
  title: string;
  description: string;
  sections: DocSection[];
};

export const docs: DocEntry[] = [
  {
    slug: "customer-booking-identity",
    title: "Customer + Booking Identity",
    description:
      "How customer accounts, booking references, and historical booking snapshots work together.",
    sections: [
      {
        heading: "Core identity model",
        bullets: [
          "Customer-facing customer identity is the email address on the account.",
          "Internal customer identity is a UUID.",
          "Customer-facing booking identity is the booking reference, such as BK-482731.",
          "Internal booking identity is still a UUID and should be used only for admin/support and integrations.",
          "One customer can have many bookings.",
        ],
      },
      {
        heading: "Historical snapshot rule",
        paragraphs: [
          "Each booking stores its own contact and service-address snapshot at the time it was created. Updating the customer profile later does not rewrite historical booking records.",
        ],
        bullets: [
          "Booking contact can differ from the account owner.",
          "Service address can differ across bookings for the same customer.",
          "Support should always verify both the customer account and the booking snapshot when something looks inconsistent.",
        ],
      },
      {
        heading: "How staff should search",
        bullets: [
          "If a customer calls in with a booking reference, search the booking by booking_ref first.",
          "If they only know their email, search the customer/account by email and then review linked bookings.",
          "If the account owner and booking contact differ, use the booking record as the operational source of truth for that job.",
        ],
      },
      {
        heading: "Examples",
        bullets: [
          "Same customer, different addresses: one customer UUID can have bookings for many service locations.",
          "Same email, different booking contact name: the customer account email stays constant, while each booking keeps its own contact snapshot.",
          "Customer updates email: the customer UUID stays the same, old bookings keep their historical booking_contact_email, and the admin history shows the email change.",
          "Deactivated portal access: portal login is disabled, but the customer and booking history remain intact.",
        ],
      },
    ],
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
