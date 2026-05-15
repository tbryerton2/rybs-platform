import "server-only";

import { getTenantContent, type TenantContentReadOptions } from "./server";

type HomeHeroContent = {
  eyebrow: string | null;
  headlineLine1: string;
  headlineLine2: string | null;
  subheadline: string;
  imageAlt: string;
  availabilityHelper: string;
  trustItems: string[];
};

type HomeServiceAreaContent = {
  modalTitle: string;
  modalIntro: string;
  coverageHeading: string;
  regionList: string[];
  coverageFootnote: string;
  unsupportedZipMessage: string;
  viewServiceAreaLabel: string;
  closeLabel: string;
};

type HomeValuePropsContent = {
  sectionTitle: string;
  intro: string;
  items: Array<{
    title: string;
    headline: string;
    body: string;
  }>;
};

type HomeHowItWorksContent = {
  sectionTitle: string;
  intro: string;
  items: Array<{
    stepLabel: string;
    title: string;
    body: string;
  }>;
  footnote: string;
};

export type HomeFlexibleSectionContent =
  | {
      id: string;
      type: "card_grid";
      sectionTitle: string;
      intro: string;
      items: Array<{
        label: string;
        headline: string;
        body: string;
      }>;
    }
  | {
      id: string;
      type: "steps";
      sectionTitle: string;
      intro: string;
      items: Array<{
        label: string;
        title: string;
        body: string;
      }>;
      footnote: string;
    };

type HomeFaqContent = {
  headline: string;
  intro: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
};

type PricingIntroContent = {
  headline: string;
  defaultBody: string;
};

type PricingPromisesContent = {
  productBody: string;
  dimensionLabel: string;
  featureList: string[];
  includedHeading: string;
  includedPricePrefix: string;
  includedPriceSuffix: string;
  includedItems: string[];
  footnote: string;
};

type SupportMarketingContent = {
  headline: string;
  body: string;
  primaryContactCtaLabel: string | null;
  responseTimeCopy: string | null;
};

type ProductMarketingContent = {
  badge: string;
  headline: string;
  description: string;
  highlightBullets: string[];
  dimensionsLabel: string;
  helperText: string;
};

type BookingEntryContent = {
  title: string;
  subtitle: string;
  sectionTitle: string;
  sectionDescription: string;
  blockedCtaText: string;
};

type BookingAddressContent = {
  title: string;
  description: string;
  serviceAreaNotice: string;
  savedLocationsTitle: string;
  savedLocationsDescription: string;
  savedLocationsManageLabel: string;
  bookingDetailsTitle: string;
  bookingDetailsDescription: string;
  savedLocationIntro: string;
  savedLocationFootnote: string;
  zipIdleHelper: string;
  zipValidTemplate: string;
  unsupportedZipMessage: string;
};

type BookingDateContent = {
  title: string;
  description: string;
  earliestAvailablePrefix: string;
  holdNoteTemplate: string;
  footerNote: string;
  nextAvailablePrefix: string;
  availabilityError: string;
};

type BookingPlacementContent = {
  title: string;
  description: string;
  addressSummaryPrefix: string;
  tipsLabel: string;
  tipsSummary: string;
  tipsExpanded: string;
  streetPermitNotice: string;
  placementExample: string;
  optionalDetailsTitle: string;
  optionalDetailsDescription: string;
  accessQuestion: string;
  accessSimpleOption: string;
  accessDetailedOption: string;
  photoUploadingLabel: string;
  photoFailedLabel: string;
};

type BookingPickupContent = {
  title: string;
  subtitle: string;
  requestOptionTitle: string;
  requestOptionDescription: string;
  scheduledOptionTitle: string;
  scheduledOptionDescription: string;
  pickupDateLabel: string;
};

type BookingSummaryContent = {
  title: string;
  subtitle: string;
  locationSummaryTitle: string;
  locationEmptyText: string;
  totalLabel: string;
  includedTitle: string;
  includedItems: string[];
  weightPolicyTitle: string;
  weightPolicyBody: string;
  weightPolicyFootnote: string;
  checkoutCtaLabel: string;
  missingZipCtaLabel: string;
};

type BookingConfirmContent = {
  title: string;
  description: string;
  reorderTitle: string;
  holdBannerTitle: string;
  holdBannerBody: string;
  capLoadingText: string;
  deliveryTimeNote: string;
  pickupWindowTemplate: string;
  pickupLaterTitle: string;
  pickupLaterDescription: string;
  pickupNowTitle: string;
  pickupEarliestPrefix: string;
};

type BookingCheckoutContent = {
  title: string;
  description: string;
  orderSummaryTitle: string;
  reorderTitle: string;
  deliveryTimeNote: string;
  pickupNotice: string;
  paymentTitle: string;
  paymentDescription: string;
  paymentIdleLabel: string;
  paymentLoadingLabel: string;
  paymentProcessingLabel: string;
  paymentFooterNote: string;
  holdExpiredNotice: string;
  chooseNewDateLabel: string;
};

type BookingSuccessContent = {
  title: string;
  description: string;
  bookingReferenceTitle: string;
  linkedBookingTemplate: string;
  orderSummaryTitle: string;
  confirmationEmailNote: string;
  portalLoggedInCtaLabel: string;
  portalLoggedOutCtaLabel: string;
  returnHomeCtaLabel: string;
};

const HOME_HERO_FALLBACK: HomeHeroContent = {
  eyebrow: null,
  headlineLine1: "Dumpster Rentals Made Easy",
  headlineLine2: null,
  subheadline: "Proudly serving Central New York with fast delivery and honest pricing.",
  imageAlt: "Clean roll-off dumpster delivery in Central New York",
  availabilityHelper: "Get instant pricing and availability in your area.",
  trustItems: ["Locally owned", "Fully insured", "Upfront pricing"],
};

const HOME_SERVICE_AREA_FALLBACK: HomeServiceAreaContent = {
  modalTitle: "Service area",
  modalIntro: "We serve select areas in Central New York.",
  coverageHeading: "Currently covered",
  regionList: [
    "Syracuse + surrounding suburbs",
    "Clay, Cicero, Liverpool",
    "Fayetteville, Manlius, DeWitt",
    "Baldwinsville, North Syracuse",
  ],
  coverageFootnote: "We’re expanding coverage. More areas coming soon.",
  unsupportedZipMessage: "We don’t currently serve ZIP",
  viewServiceAreaLabel: "View service area",
  closeLabel: "Got it",
};

const HOME_VALUE_PROPS_FALLBACK: HomeValuePropsContent = {
  sectionTitle: "Why choose Tan Can Man?",
  intro: "Simple pricing, reliable delivery, and easy online booking.",
  items: [
    {
      title: "Upfront pricing",
      headline: "Flat-rate, no surprises",
      body: "Know your total cost up front. No surprise fees or confusing add-ons.",
    },
    {
      title: "Reliable service",
      headline: "On-time delivery & pickup",
      body: "We show up when we say we will—and make pickup just as easy.",
    },
    {
      title: "Local & trusted",
      headline: "Proudly Central New York",
      body: "Locally owned and operated, focused on dependable service and straightforward pricing.",
    },
  ],
};

const HOME_HOW_IT_WORKS_FALLBACK: HomeHowItWorksContent = {
  sectionTitle: "How it works",
  intro: "Simple from delivery to pickup — we’ll keep it easy.",
  items: [
    {
      stepLabel: "Step 1",
      title: "Pick your delivery date",
      body: "Choose a date that works for your project — we’ll confirm quickly.",
    },
    {
      stepLabel: "Step 2",
      title: "We drop it where you want it",
      body: "Driveway placement notes supported — we’ll place it safely and neatly.",
    },
    {
      stepLabel: "Step 3",
      title: "Fill it, then request pickup",
      body: "When you’re ready, request pickup and we’ll haul it away.",
    },
  ],
  footnote: "Included weight allowances vary by dumpster size. Overages billed only if exceeded.",
};

const HOME_FAQ_FALLBACK: HomeFaqContent = {
  headline: "FAQs",
  intro: "Quick answers to the most common questions.",
  items: [
    {
      question: "What’s included in the flat-rate price?",
      answer:
        "Delivery, pickup, and your included weight allowance are all covered. If you exceed the included tonnage, we only charge the overage — no surprise fees.",
    },
    {
      question: "How long can I keep the dumpster?",
      answer:
        "Every booking includes a standard rental period. If you need extra time, we can review extra days and any added charges.",
    },
    {
      question: "Where can you place the dumpster?",
      answer:
        "Driveways are most common. If placement on a street is needed, permits may be required depending on the town. We’ll help you confirm what’s needed.",
    },
    {
      question: "What items are not allowed?",
      answer:
        "Common restricted items include tires, batteries, paint, chemicals, and certain electronics. If you’re unsure, text us a photo or list and we’ll confirm quickly.",
    },
    {
      question: "How fast can you deliver?",
      answer:
        "Often next-day delivery is available, and sometimes same-day depending on schedule. Enter your ZIP code or call/text and we’ll confirm the soonest option.",
    },
  ],
};

const PRICING_INTRO_FALLBACK: PricingIntroContent = {
  headline: "Dumpster Pricing",
  defaultBody: "Simple flat-rate pricing for Central New York.",
};

const PRICING_PROMISES_FALLBACK: PricingPromisesContent = {
  productBody:
    "Base pricing includes delivery, pickup, the standard rental period, and the standard weight allowance.",
  dimensionLabel: "7' × 14' × 4'",
  featureList: ["Included weight shown by dumpster size"],
  includedHeading: "What’s included in your rental",
  includedPricePrefix: "All included in the",
  includedPriceSuffix: "flat rate",
  includedItems: [
    "Delivery & pickup included",
    "Included weight shown by dumpster size",
    "Standard rental period included",
    "No hidden fees",
  ],
  footnote: "Extra days and weight overages are billed only when they apply.",
};

const SUPPORT_MARKETING_FALLBACK: SupportMarketingContent = {
  headline: "Ready to book your dumpster?",
  body: "Check availability in your area — fast delivery, honest pricing, and friendly local support.",
  primaryContactCtaLabel: null,
  responseTimeCopy: null,
};

const PRODUCT_MARKETING_FALLBACK: ProductMarketingContent = {
  badge: "Most Popular",
  headline: "14-Foot Dumpster",
  description: "Includes delivery, pickup & standard weight allowance. No hidden fees.",
  highlightBullets: ["Great for cleanouts", "Small remodels", "Flooring & furniture"],
  dimensionsLabel: "7' × 14' × 4'",
  helperText: "One simple option to keep booking fast.",
};

const BOOKING_ENTRY_FALLBACK: BookingEntryContent = {
  title: "Book Your Dumpster",
  subtitle: "Dumpster selection",
  sectionTitle: "Choose your dumpster",
  sectionDescription: "One simple option to keep booking fast.",
  blockedCtaText: "Enter a serviced ZIP to continue",
};

const BOOKING_ADDRESS_FALLBACK: BookingAddressContent = {
  title: "Delivery Address",
  description: "Add your contact info and service address to get started.",
  serviceAreaNotice: "We currently service Onondaga and Madison Counties, NY.",
  savedLocationsTitle: "Use a saved location",
  savedLocationsDescription: "Start with your default location or pick another saved address, then update anything you need below.",
  savedLocationsManageLabel: "Manage saved locations",
  bookingDetailsTitle: "Booking details",
  bookingDetailsDescription: "This is where we will deliver the dumpster and how we will contact you about the job.",
  savedLocationIntro: "Using this saved location as the starting point for this booking.",
  savedLocationFootnote: "Editing these details later only changes this booking. It does not update the saved location automatically.",
  zipIdleHelper: "Enter a ZIP, then tap Save ZIP.",
  zipValidTemplate: "Service available in {town}, {county} County.",
  unsupportedZipMessage: "We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.",
};

const BOOKING_DATE_FALLBACK: BookingDateContent = {
  title: "Choose an open delivery day",
  description: "Availability is visible up front, so the next opening is easy to spot.",
  earliestAvailablePrefix: "Earliest available:",
  holdNoteTemplate: "We'll hold your selected dates for {minutes} minutes while you finish booking.",
  footerNote: "Disabled dates are not bookable online. Availability updates automatically as inventory changes.",
  nextAvailablePrefix: "Next available delivery date:",
  availabilityError: "Could not load calendar availability.",
};

const BOOKING_PLACEMENT_FALLBACK: BookingPlacementContent = {
  title: "Placement & access",
  description: "Tell us where to place the dumpster. We will only ask for extra details if needed.",
  addressSummaryPrefix: "Delivery address:",
  tipsLabel: "Delivery tips:",
  tipsSummary: "Clear cars, watch low branches/wires, choose a flat accessible area.",
  tipsExpanded: "Street placement may require a permit in some municipalities. If you will not be home, be specific and add a photo if it helps show the driver exactly where to place the dumpster.",
  streetPermitNotice: "Street placement may require a local permit depending on your municipality.",
  placementExample: "Example: right side of driveway near the garage.",
  optionalDetailsTitle: "Optional details",
  optionalDetailsDescription: "Only add these if they help us deliver more accurately.",
  accessQuestion: "Anything that could make delivery tricky?",
  accessSimpleOption: "No, access is straightforward",
  accessDetailedOption: "Yes, there are a few details",
  photoUploadingLabel: "Uploading photo...",
  photoFailedLabel: "Photo upload failed. Please try again.",
};

const BOOKING_PICKUP_FALLBACK: BookingPickupContent = {
  title: "Book Your Dumpster",
  subtitle: "Pickup preference",
  requestOptionTitle: "Request pickup when ready",
  requestOptionDescription: "Most customers choose this.",
  scheduledOptionTitle: "Schedule pickup date",
  scheduledOptionDescription: "Choose a specific date if you need it removed by a deadline.",
  pickupDateLabel: "Pickup date",
};

const BOOKING_SUMMARY_FALLBACK: BookingSummaryContent = {
  title: "Book Your Dumpster",
  subtitle: "Price summary",
  locationSummaryTitle: "Service address (v1)",
  locationEmptyText: "No ZIP saved yet. Please go back and validate your ZIP.",
  totalLabel: "Flat-rate total (prepay)",
  includedTitle: "What’s included",
  includedItems: ["Delivery & pickup", "Standard rental period included", "2.5 tons included"],
  weightPolicyTitle: "Included Weight Policy",
  weightPolicyBody: "Your flat rate includes up to 2.5 tons. Overages are billed only if exceeded.",
  weightPolicyFootnote: "Most homeowners stay under the included weight.",
  checkoutCtaLabel: "Proceed to Secure Payment",
  missingZipCtaLabel: "Go validate ZIP",
};

const BOOKING_CONFIRM_FALLBACK: BookingConfirmContent = {
  title: "Confirm Your Booking",
  description: "Review your details. We’ll finalize everything on the next step.",
  reorderTitle: "New booking based on a previous rental",
  holdBannerTitle: "Your delivery date is being held. Time left: {time}",
  holdBannerBody: "If this timer hits 00:00, you’ll need to choose a new date.",
  capLoadingText: "Checking availability limits…",
  deliveryTimeNote: "We’ll contact you with the exact delivery time.",
  pickupWindowTemplate: "Pickup must be scheduled between {min} and {max}. Dates outside this window are unavailable.",
  pickupLaterTitle: "Included rental period",
  pickupLaterDescription: "Your pickup date is scheduled as part of booking.",
  pickupNowTitle: "Choose a pickup date",
  pickupEarliestPrefix: "Earliest allowed pickup:",
};

const BOOKING_CHECKOUT_FALLBACK: BookingCheckoutContent = {
  title: "Checkout",
  description: "Complete your booking.",
  orderSummaryTitle: "Order summary",
  reorderTitle: "New booking based on a previous rental",
  deliveryTimeNote: "We’ll contact you with the exact delivery time.",
  pickupNotice: "24-hour notice required.",
  paymentTitle: "Payment",
  paymentDescription: "Secure payment processing. Your dumpster will be officially booked after successful payment.",
  paymentIdleLabel: "Simulate successful payment",
  paymentLoadingLabel: "Loading pricing...",
  paymentProcessingLabel: "Processing...",
  paymentFooterNote: "You will receive a confirmation email immediately after booking.",
  holdExpiredNotice: "Your delivery date hold has expired. Please go back and choose a new delivery date.",
  chooseNewDateLabel: "Choose a new delivery date",
};

const BOOKING_SUCCESS_FALLBACK: BookingSuccessContent = {
  title: "Booking confirmed",
  description: "Your dumpster has been reserved and we’ve created a new booking for you.",
  bookingReferenceTitle: "Booking reference",
  linkedBookingTemplate: "This booking is linked to {email}. Use that email to access your portal and manage this booking.",
  orderSummaryTitle: "Order summary",
  confirmationEmailNote: "You’ll receive a confirmation email shortly with your delivery details and booking reference.",
  portalLoggedInCtaLabel: "Go to my portal",
  portalLoggedOutCtaLabel: "Access my portal",
  returnHomeCtaLabel: "Return home",
};

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNullableString(value: unknown, fallback: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return items.length ? items : fallback;
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asRecordArray(value: unknown) {
  return Array.isArray(value) ? value.map(asObject) : [];
}

export async function getHomeHeroContent(
  options?: TenantContentReadOptions,
): Promise<HomeHeroContent> {
  const raw = asObject(await getTenantContent("content.home.hero", options));
  const headlineLine1 = asString(raw.headlineLine1 ?? raw.headline, HOME_HERO_FALLBACK.headlineLine1);
  const headlineLine2 = asNullableString(raw.headlineLine2, HOME_HERO_FALLBACK.headlineLine2);

  return {
    eyebrow: asNullableString(raw.eyebrow, HOME_HERO_FALLBACK.eyebrow),
    headlineLine1,
    headlineLine2,
    subheadline: asString(raw.subheadline, HOME_HERO_FALLBACK.subheadline),
    imageAlt: asString(raw.imageAlt, HOME_HERO_FALLBACK.imageAlt),
    availabilityHelper: asString(raw.availabilityHelper, HOME_HERO_FALLBACK.availabilityHelper),
    trustItems: asStringArray(raw.trustItems ?? raw.trustBullets, HOME_HERO_FALLBACK.trustItems),
  };
}

export async function getHomeServiceAreaContent(
  options?: TenantContentReadOptions,
): Promise<HomeServiceAreaContent> {
  const raw = asObject(
    (await getTenantContent("content.home.service_area_popup", options)) ??
      (await getTenantContent("content.home.service_area", options)),
  );

  return {
    modalTitle: asString(raw.modalTitle ?? raw.title, HOME_SERVICE_AREA_FALLBACK.modalTitle),
    modalIntro: asString(raw.modalIntro ?? raw.intro, HOME_SERVICE_AREA_FALLBACK.modalIntro),
    coverageHeading: asString(raw.coverageHeading ?? raw.coverageTitle, HOME_SERVICE_AREA_FALLBACK.coverageHeading),
    regionList: asStringArray(raw.regionList ?? raw.coverageBullets, HOME_SERVICE_AREA_FALLBACK.regionList),
    coverageFootnote: asString(raw.coverageFootnote ?? raw.bottomNote, HOME_SERVICE_AREA_FALLBACK.coverageFootnote),
    unsupportedZipMessage: asString(
      raw.unsupportedZipMessage,
      HOME_SERVICE_AREA_FALLBACK.unsupportedZipMessage,
    ),
    viewServiceAreaLabel: asString(
      raw.viewServiceAreaLabel ?? raw.buttonLabel,
      HOME_SERVICE_AREA_FALLBACK.viewServiceAreaLabel,
    ),
    closeLabel: asString(raw.closeLabel, HOME_SERVICE_AREA_FALLBACK.closeLabel),
  };
}

export async function getHomeValuePropsContent(
  options?: TenantContentReadOptions,
): Promise<HomeValuePropsContent> {
  const raw = asObject(await getTenantContent("content.home.value_props", options));
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    sectionTitle: asString(raw.sectionTitle, HOME_VALUE_PROPS_FALLBACK.sectionTitle),
    intro: asString(raw.intro, HOME_VALUE_PROPS_FALLBACK.intro),
    items:
      items.length > 0
        ? items.map((item, index) => {
            const fallback = HOME_VALUE_PROPS_FALLBACK.items[index] ?? HOME_VALUE_PROPS_FALLBACK.items[0];
            const record = asObject(item);
            return {
              title: asString(record.title ?? record.label, fallback.title),
              headline: asString(record.headline, fallback.headline),
              body: asString(record.body, fallback.body),
            };
          })
        : HOME_VALUE_PROPS_FALLBACK.items,
  };
}

function normalizeHomeFlexibleSections(rawValue: unknown): HomeFlexibleSectionContent[] {
  const raw = asObject(rawValue);
  const source = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(raw.sections)
      ? raw.sections
      : [];

  return source
    .map(asObject)
    .flatMap((item, index) => {
      const type = asString(item.type);

      if (type === "card_grid") {
        return [
          {
            id: asString(item.id, `card-grid-${index + 1}`),
            type: "card_grid" as const,
            sectionTitle: asString(item.sectionTitle, HOME_VALUE_PROPS_FALLBACK.sectionTitle),
            intro: asString(item.intro, HOME_VALUE_PROPS_FALLBACK.intro),
            items: asRecordArray(item.items).map((entry, itemIndex) => {
              const fallback =
                HOME_VALUE_PROPS_FALLBACK.items[itemIndex] ?? HOME_VALUE_PROPS_FALLBACK.items[0];

              return {
                label: asString(entry.label ?? entry.title, fallback.title),
                headline: asString(entry.headline, fallback.headline),
                body: asString(entry.body, fallback.body),
              };
            }),
          },
        ];
      }

      if (type === "steps") {
        return [
          {
            id: asString(item.id, `steps-${index + 1}`),
            type: "steps" as const,
            sectionTitle: asString(item.sectionTitle, HOME_HOW_IT_WORKS_FALLBACK.sectionTitle),
            intro: asString(item.intro, HOME_HOW_IT_WORKS_FALLBACK.intro),
            items: asRecordArray(item.items).map((entry, itemIndex) => {
              const fallback =
                HOME_HOW_IT_WORKS_FALLBACK.items[itemIndex] ?? HOME_HOW_IT_WORKS_FALLBACK.items[0];

              return {
                label: asString(entry.label ?? entry.stepLabel, fallback.stepLabel),
                title: asString(entry.title, fallback.title),
                body: asString(entry.body, fallback.body),
              };
            }),
            footnote: asString(item.footnote, HOME_HOW_IT_WORKS_FALLBACK.footnote),
          },
        ];
      }

      return [];
    });
}

export async function getHomeSectionsContent(
  options?: TenantContentReadOptions,
): Promise<HomeFlexibleSectionContent[]> {
  const rawSections = await getTenantContent("content.home.sections", options);
  const normalized = normalizeHomeFlexibleSections(rawSections);

  if (normalized.length > 0) {
    return normalized;
  }

  const [valueProps, howItWorks] = await Promise.all([
    getHomeValuePropsContent(options),
    getHomeHowItWorksContent(options),
  ]);

  return [
    {
      id: "why-choose-us",
      type: "card_grid",
      sectionTitle: valueProps.sectionTitle,
      intro: valueProps.intro,
      items: valueProps.items.map((item) => ({
        label: item.title,
        headline: item.headline,
        body: item.body,
      })),
    },
    {
      id: "how-it-works",
      type: "steps",
      sectionTitle: howItWorks.sectionTitle,
      intro: howItWorks.intro,
      items: howItWorks.items.map((item) => ({
        label: item.stepLabel,
        title: item.title,
        body: item.body,
      })),
      footnote: howItWorks.footnote,
    },
  ];
}

export async function getHomeHowItWorksContent(
  options?: TenantContentReadOptions,
): Promise<HomeHowItWorksContent> {
  const raw = asObject(await getTenantContent("content.home.how_it_works", options));
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    sectionTitle: asString(raw.sectionTitle, HOME_HOW_IT_WORKS_FALLBACK.sectionTitle),
    intro: asString(raw.intro, HOME_HOW_IT_WORKS_FALLBACK.intro),
    items:
      items.length > 0
        ? items.map((item, index) => {
            const fallback = HOME_HOW_IT_WORKS_FALLBACK.items[index] ?? HOME_HOW_IT_WORKS_FALLBACK.items[0];
            const record = asObject(item);
            return {
              stepLabel: asString(record.stepLabel, fallback.stepLabel),
              title: asString(record.title, fallback.title),
              body: asString(record.body, fallback.body),
            };
          })
        : HOME_HOW_IT_WORKS_FALLBACK.items,
    footnote: asString(raw.footnote, HOME_HOW_IT_WORKS_FALLBACK.footnote),
  };
}

export async function getHomeFaqContent(
  options?: TenantContentReadOptions,
): Promise<HomeFaqContent> {
  const raw = asObject(await getTenantContent("content.faq.home", options));
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    headline: asString(raw.headline, HOME_FAQ_FALLBACK.headline),
    intro: asString(raw.intro, HOME_FAQ_FALLBACK.intro),
    items:
      items.length > 0
        ? items.map((item, index) => {
            const fallback = HOME_FAQ_FALLBACK.items[index] ?? HOME_FAQ_FALLBACK.items[0];
            const record = asObject(item);
            return {
              question: asString(record.question, fallback.question),
              answer: asString(record.answer, fallback.answer),
            };
          })
        : HOME_FAQ_FALLBACK.items,
  };
}

export async function getPricingIntroContent(
  options?: TenantContentReadOptions,
): Promise<PricingIntroContent> {
  const raw = asObject(await getTenantContent("content.pricing.intro", options));

  return {
    headline: asString(raw.headline, PRICING_INTRO_FALLBACK.headline),
    defaultBody: asString(raw.defaultBody, PRICING_INTRO_FALLBACK.defaultBody),
  };
}

export async function getPricingPromisesContent(
  options?: TenantContentReadOptions,
): Promise<PricingPromisesContent> {
  const raw = asObject(
    (await getTenantContent("content.pricing.product_content", options)) ??
      (await getTenantContent("content.pricing.promises", options)),
  );

  return {
    productBody: asString(raw.productBody ?? raw.description, PRICING_PROMISES_FALLBACK.productBody),
    dimensionLabel: asString(raw.dimensionLabel, PRICING_PROMISES_FALLBACK.dimensionLabel),
    featureList: asStringArray(raw.featureList ?? raw.featureBullets, PRICING_PROMISES_FALLBACK.featureList),
    includedHeading: asString(raw.includedHeading, PRICING_PROMISES_FALLBACK.includedHeading),
    includedPricePrefix: asString(
      raw.includedPricePrefix,
      PRICING_PROMISES_FALLBACK.includedPricePrefix,
    ),
    includedPriceSuffix: asString(
      raw.includedPriceSuffix,
      PRICING_PROMISES_FALLBACK.includedPriceSuffix,
    ),
    includedItems: asStringArray(raw.includedItems, PRICING_PROMISES_FALLBACK.includedItems),
    footnote: asString(raw.footnote ?? raw.bottomNote, PRICING_PROMISES_FALLBACK.footnote),
  };
}

export async function getSupportMarketingContent(
  options?: TenantContentReadOptions,
): Promise<SupportMarketingContent> {
  const raw = asObject(await getTenantContent("content.support.marketing", options));

  return {
    headline: asString(raw.headline, SUPPORT_MARKETING_FALLBACK.headline),
    body: asString(raw.body, SUPPORT_MARKETING_FALLBACK.body),
    primaryContactCtaLabel: asNullableString(
      raw.primaryContactCtaLabel,
      SUPPORT_MARKETING_FALLBACK.primaryContactCtaLabel,
    ),
    responseTimeCopy: asNullableString(
      raw.responseTimeCopy,
      SUPPORT_MARKETING_FALLBACK.responseTimeCopy,
    ),
  };
}

export async function getProductMarketingContent(
  productId = "default",
): Promise<ProductMarketingContent> {
  const raw = asObject(
    await getTenantContent(`content.catalog.product_marketing.${productId}`),
  );

  return {
    badge: asString(raw.badge, PRODUCT_MARKETING_FALLBACK.badge),
    headline: asString(raw.headline, PRODUCT_MARKETING_FALLBACK.headline),
    description: asString(raw.description, PRODUCT_MARKETING_FALLBACK.description),
    highlightBullets: asStringArray(raw.highlightBullets, PRODUCT_MARKETING_FALLBACK.highlightBullets),
    dimensionsLabel: asString(raw.dimensionsLabel, PRODUCT_MARKETING_FALLBACK.dimensionsLabel),
    helperText: asString(raw.helperText, PRODUCT_MARKETING_FALLBACK.helperText),
  };
}

export async function getBookingEntryContent(): Promise<BookingEntryContent> {
  const raw = asObject(await getTenantContent("content.booking.entry"));

  return {
    title: asString(raw.title, BOOKING_ENTRY_FALLBACK.title),
    subtitle: asString(raw.subtitle, BOOKING_ENTRY_FALLBACK.subtitle),
    sectionTitle: asString(raw.sectionTitle, BOOKING_ENTRY_FALLBACK.sectionTitle),
    sectionDescription: asString(raw.sectionDescription, BOOKING_ENTRY_FALLBACK.sectionDescription),
    blockedCtaText: asString(raw.blockedCtaText, BOOKING_ENTRY_FALLBACK.blockedCtaText),
  };
}

export async function getBookingAddressContent(): Promise<BookingAddressContent> {
  const raw = asObject(await getTenantContent("content.booking.address"));

  return {
    title: asString(raw.title, BOOKING_ADDRESS_FALLBACK.title),
    description: asString(raw.description, BOOKING_ADDRESS_FALLBACK.description),
    serviceAreaNotice: asString(raw.serviceAreaNotice, BOOKING_ADDRESS_FALLBACK.serviceAreaNotice),
    savedLocationsTitle: asString(raw.savedLocationsTitle, BOOKING_ADDRESS_FALLBACK.savedLocationsTitle),
    savedLocationsDescription: asString(
      raw.savedLocationsDescription,
      BOOKING_ADDRESS_FALLBACK.savedLocationsDescription,
    ),
    savedLocationsManageLabel: asString(
      raw.savedLocationsManageLabel,
      BOOKING_ADDRESS_FALLBACK.savedLocationsManageLabel,
    ),
    bookingDetailsTitle: asString(raw.bookingDetailsTitle, BOOKING_ADDRESS_FALLBACK.bookingDetailsTitle),
    bookingDetailsDescription: asString(
      raw.bookingDetailsDescription,
      BOOKING_ADDRESS_FALLBACK.bookingDetailsDescription,
    ),
    savedLocationIntro: asString(raw.savedLocationIntro, BOOKING_ADDRESS_FALLBACK.savedLocationIntro),
    savedLocationFootnote: asString(
      raw.savedLocationFootnote,
      BOOKING_ADDRESS_FALLBACK.savedLocationFootnote,
    ),
    zipIdleHelper: asString(raw.zipIdleHelper, BOOKING_ADDRESS_FALLBACK.zipIdleHelper),
    zipValidTemplate: asString(raw.zipValidTemplate, BOOKING_ADDRESS_FALLBACK.zipValidTemplate),
    unsupportedZipMessage: asString(
      raw.unsupportedZipMessage,
      BOOKING_ADDRESS_FALLBACK.unsupportedZipMessage,
    ),
  };
}

export async function getBookingDateContent(): Promise<BookingDateContent> {
  const raw = asObject(await getTenantContent("content.booking.date"));

  return {
    title: asString(raw.title, BOOKING_DATE_FALLBACK.title),
    description: asString(raw.description, BOOKING_DATE_FALLBACK.description),
    earliestAvailablePrefix: asString(
      raw.earliestAvailablePrefix,
      BOOKING_DATE_FALLBACK.earliestAvailablePrefix,
    ),
    holdNoteTemplate: asString(raw.holdNoteTemplate, BOOKING_DATE_FALLBACK.holdNoteTemplate),
    footerNote: asString(raw.footerNote, BOOKING_DATE_FALLBACK.footerNote),
    nextAvailablePrefix: asString(raw.nextAvailablePrefix, BOOKING_DATE_FALLBACK.nextAvailablePrefix),
    availabilityError: asString(raw.availabilityError, BOOKING_DATE_FALLBACK.availabilityError),
  };
}

export async function getBookingPlacementContent(): Promise<BookingPlacementContent> {
  const raw = asObject(await getTenantContent("content.booking.placement"));

  return {
    title: asString(raw.title, BOOKING_PLACEMENT_FALLBACK.title),
    description: asString(raw.description, BOOKING_PLACEMENT_FALLBACK.description),
    addressSummaryPrefix: asString(
      raw.addressSummaryPrefix,
      BOOKING_PLACEMENT_FALLBACK.addressSummaryPrefix,
    ),
    tipsLabel: asString(raw.tipsLabel, BOOKING_PLACEMENT_FALLBACK.tipsLabel),
    tipsSummary: asString(raw.tipsSummary, BOOKING_PLACEMENT_FALLBACK.tipsSummary),
    tipsExpanded: asString(raw.tipsExpanded, BOOKING_PLACEMENT_FALLBACK.tipsExpanded),
    streetPermitNotice: asString(
      raw.streetPermitNotice,
      BOOKING_PLACEMENT_FALLBACK.streetPermitNotice,
    ),
    placementExample: asString(raw.placementExample, BOOKING_PLACEMENT_FALLBACK.placementExample),
    optionalDetailsTitle: asString(
      raw.optionalDetailsTitle,
      BOOKING_PLACEMENT_FALLBACK.optionalDetailsTitle,
    ),
    optionalDetailsDescription: asString(
      raw.optionalDetailsDescription,
      BOOKING_PLACEMENT_FALLBACK.optionalDetailsDescription,
    ),
    accessQuestion: asString(raw.accessQuestion, BOOKING_PLACEMENT_FALLBACK.accessQuestion),
    accessSimpleOption: asString(
      raw.accessSimpleOption,
      BOOKING_PLACEMENT_FALLBACK.accessSimpleOption,
    ),
    accessDetailedOption: asString(
      raw.accessDetailedOption,
      BOOKING_PLACEMENT_FALLBACK.accessDetailedOption,
    ),
    photoUploadingLabel: asString(
      raw.photoUploadingLabel,
      BOOKING_PLACEMENT_FALLBACK.photoUploadingLabel,
    ),
    photoFailedLabel: asString(raw.photoFailedLabel, BOOKING_PLACEMENT_FALLBACK.photoFailedLabel),
  };
}

export async function getBookingPickupContent(): Promise<BookingPickupContent> {
  const raw = asObject(await getTenantContent("content.booking.pickup"));

  return {
    title: asString(raw.title, BOOKING_PICKUP_FALLBACK.title),
    subtitle: asString(raw.subtitle, BOOKING_PICKUP_FALLBACK.subtitle),
    requestOptionTitle: asString(raw.requestOptionTitle, BOOKING_PICKUP_FALLBACK.requestOptionTitle),
    requestOptionDescription: asString(
      raw.requestOptionDescription,
      BOOKING_PICKUP_FALLBACK.requestOptionDescription,
    ),
    scheduledOptionTitle: asString(
      raw.scheduledOptionTitle,
      BOOKING_PICKUP_FALLBACK.scheduledOptionTitle,
    ),
    scheduledOptionDescription: asString(
      raw.scheduledOptionDescription,
      BOOKING_PICKUP_FALLBACK.scheduledOptionDescription,
    ),
    pickupDateLabel: asString(raw.pickupDateLabel, BOOKING_PICKUP_FALLBACK.pickupDateLabel),
  };
}

export async function getBookingSummaryContent(): Promise<BookingSummaryContent> {
  const raw = asObject(await getTenantContent("content.booking.summary"));

  return {
    title: asString(raw.title, BOOKING_SUMMARY_FALLBACK.title),
    subtitle: asString(raw.subtitle, BOOKING_SUMMARY_FALLBACK.subtitle),
    locationSummaryTitle: asString(
      raw.locationSummaryTitle,
      BOOKING_SUMMARY_FALLBACK.locationSummaryTitle,
    ),
    locationEmptyText: asString(raw.locationEmptyText, BOOKING_SUMMARY_FALLBACK.locationEmptyText),
    totalLabel: asString(raw.totalLabel, BOOKING_SUMMARY_FALLBACK.totalLabel),
    includedTitle: asString(raw.includedTitle, BOOKING_SUMMARY_FALLBACK.includedTitle),
    includedItems: asStringArray(raw.includedItems, BOOKING_SUMMARY_FALLBACK.includedItems),
    weightPolicyTitle: asString(raw.weightPolicyTitle, BOOKING_SUMMARY_FALLBACK.weightPolicyTitle),
    weightPolicyBody: asString(raw.weightPolicyBody, BOOKING_SUMMARY_FALLBACK.weightPolicyBody),
    weightPolicyFootnote: asString(
      raw.weightPolicyFootnote,
      BOOKING_SUMMARY_FALLBACK.weightPolicyFootnote,
    ),
    checkoutCtaLabel: asString(raw.checkoutCtaLabel, BOOKING_SUMMARY_FALLBACK.checkoutCtaLabel),
    missingZipCtaLabel: asString(
      raw.missingZipCtaLabel,
      BOOKING_SUMMARY_FALLBACK.missingZipCtaLabel,
    ),
  };
}

export async function getBookingConfirmContent(): Promise<BookingConfirmContent> {
  const raw = asObject(await getTenantContent("content.booking.confirm"));

  return {
    title: asString(raw.title, BOOKING_CONFIRM_FALLBACK.title),
    description: asString(raw.description, BOOKING_CONFIRM_FALLBACK.description),
    reorderTitle: asString(raw.reorderTitle, BOOKING_CONFIRM_FALLBACK.reorderTitle),
    holdBannerTitle: asString(raw.holdBannerTitle, BOOKING_CONFIRM_FALLBACK.holdBannerTitle),
    holdBannerBody: asString(raw.holdBannerBody, BOOKING_CONFIRM_FALLBACK.holdBannerBody),
    capLoadingText: asString(raw.capLoadingText, BOOKING_CONFIRM_FALLBACK.capLoadingText),
    deliveryTimeNote: asString(raw.deliveryTimeNote, BOOKING_CONFIRM_FALLBACK.deliveryTimeNote),
    pickupWindowTemplate: asString(
      raw.pickupWindowTemplate,
      BOOKING_CONFIRM_FALLBACK.pickupWindowTemplate,
    ),
    pickupLaterTitle: asString(raw.pickupLaterTitle, BOOKING_CONFIRM_FALLBACK.pickupLaterTitle),
    pickupLaterDescription: asString(
      raw.pickupLaterDescription,
      BOOKING_CONFIRM_FALLBACK.pickupLaterDescription,
    ),
    pickupNowTitle: asString(raw.pickupNowTitle, BOOKING_CONFIRM_FALLBACK.pickupNowTitle),
    pickupEarliestPrefix: asString(
      raw.pickupEarliestPrefix,
      BOOKING_CONFIRM_FALLBACK.pickupEarliestPrefix,
    ),
  };
}

export async function getBookingCheckoutContent(): Promise<BookingCheckoutContent> {
  const raw = asObject(await getTenantContent("content.booking.checkout"));

  return {
    title: asString(raw.title, BOOKING_CHECKOUT_FALLBACK.title),
    description: asString(raw.description, BOOKING_CHECKOUT_FALLBACK.description),
    orderSummaryTitle: asString(raw.orderSummaryTitle, BOOKING_CHECKOUT_FALLBACK.orderSummaryTitle),
    reorderTitle: asString(raw.reorderTitle, BOOKING_CHECKOUT_FALLBACK.reorderTitle),
    deliveryTimeNote: asString(raw.deliveryTimeNote, BOOKING_CHECKOUT_FALLBACK.deliveryTimeNote),
    pickupNotice: asString(raw.pickupNotice, BOOKING_CHECKOUT_FALLBACK.pickupNotice),
    paymentTitle: asString(raw.paymentTitle, BOOKING_CHECKOUT_FALLBACK.paymentTitle),
    paymentDescription: asString(raw.paymentDescription, BOOKING_CHECKOUT_FALLBACK.paymentDescription),
    paymentIdleLabel: asString(raw.paymentIdleLabel, BOOKING_CHECKOUT_FALLBACK.paymentIdleLabel),
    paymentLoadingLabel: asString(raw.paymentLoadingLabel, BOOKING_CHECKOUT_FALLBACK.paymentLoadingLabel),
    paymentProcessingLabel: asString(
      raw.paymentProcessingLabel,
      BOOKING_CHECKOUT_FALLBACK.paymentProcessingLabel,
    ),
    paymentFooterNote: asString(raw.paymentFooterNote, BOOKING_CHECKOUT_FALLBACK.paymentFooterNote),
    holdExpiredNotice: asString(raw.holdExpiredNotice, BOOKING_CHECKOUT_FALLBACK.holdExpiredNotice),
    chooseNewDateLabel: asString(
      raw.chooseNewDateLabel,
      BOOKING_CHECKOUT_FALLBACK.chooseNewDateLabel,
    ),
  };
}

export async function getBookingSuccessContent(): Promise<BookingSuccessContent> {
  const raw = asObject(await getTenantContent("content.booking.success"));

  return {
    title: asString(raw.title, BOOKING_SUCCESS_FALLBACK.title),
    description: asString(raw.description, BOOKING_SUCCESS_FALLBACK.description),
    bookingReferenceTitle: asString(
      raw.bookingReferenceTitle,
      BOOKING_SUCCESS_FALLBACK.bookingReferenceTitle,
    ),
    linkedBookingTemplate: asString(
      raw.linkedBookingTemplate,
      BOOKING_SUCCESS_FALLBACK.linkedBookingTemplate,
    ),
    orderSummaryTitle: asString(raw.orderSummaryTitle, BOOKING_SUCCESS_FALLBACK.orderSummaryTitle),
    confirmationEmailNote: asString(
      raw.confirmationEmailNote,
      BOOKING_SUCCESS_FALLBACK.confirmationEmailNote,
    ),
    portalLoggedInCtaLabel: asString(
      raw.portalLoggedInCtaLabel,
      BOOKING_SUCCESS_FALLBACK.portalLoggedInCtaLabel,
    ),
    portalLoggedOutCtaLabel: asString(
      raw.portalLoggedOutCtaLabel,
      BOOKING_SUCCESS_FALLBACK.portalLoggedOutCtaLabel,
    ),
    returnHomeCtaLabel: asString(
      raw.returnHomeCtaLabel,
      BOOKING_SUCCESS_FALLBACK.returnHomeCtaLabel,
    ),
  };
}
