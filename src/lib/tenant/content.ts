import "server-only";

import { RENTAL_TERMS_CONSENT_TEXT } from "@/lib/booking-terms";
import { normalizeHomeStatsIconKey, type HomeStatsIconKey } from "@/lib/home-stats-icons";
import { getTenantContent, type TenantContentReadOptions } from "./server";

type HomeHeroContent = {
  eyebrow: string | null;
  headlineLine1: string;
  headlineLine2: string | null;
  subheadline: string;
  imageUrl: string;
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

export type HomeStatsBarContent = {
  enabled: boolean;
  items: Array<{
    id: string;
    text: string;
    icon: HomeStatsIconKey;
    sort_order: number;
    active: boolean;
  }>;
};

export type HomeDumpsterSizeContent = {
  id: string;
  sizeYards: number;
  title: string;
  shortDescription: string;
  longDescription: string;
  checklistItems: string[];
  dimensions: string;
  weightIncluded: string;
  rentalWindowDays: number | null;
  badgeLabel: string;
  isFeatured: boolean;
};

export type HomeDumpsterSizesContent = {
  enabled: boolean;
  eyebrow: string;
  title: string;
  intro: string;
  items: HomeDumpsterSizeContent[];
};

export type HomeServiceAreaLookupContent = {
  enabled: boolean;
  eyebrow: string;
  headline: string;
  description: string;
  zipPlaceholder: string;
  buttonText: string;
  areasEyebrow: string;
  areaPills: string[];
  helperText: string;
};

type HomeValuePropsContent = {
  sectionTitle: string;
  intro: string;
  items: Array<{
    title: string;
    headline: string;
    body: string;
    icon: HomeStatsIconKey;
  }>;
};

type HomeHowItWorksContent = {
  sectionTitle: string;
  intro: string;
  items: Array<{
    stepLabel: string;
    title: string;
    body: string;
    icon: HomeStatsIconKey;
  }>;
  footnote: string;
};

export type HomeFlexibleSectionContent =
  | {
      id: string;
      type: "card_grid";
      caption: string;
      sectionTitle: string;
      intro: string;
      items: Array<{
        label: string;
        headline: string;
        body: string;
        icon: HomeStatsIconKey;
      }>;
    }
  | {
      id: string;
      type: "steps";
      caption: string;
      sectionTitle: string;
      intro: string;
      items: Array<{
        label: string;
        title: string;
        body: string;
        icon: HomeStatsIconKey;
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

export type PricingSizeGuideRowContent = {
  id: string;
  sizeLabel: string;
  truckLoadEstimate: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

export type PricingSizeGuideContent = {
  enabled: boolean;
  buttonText: string;
  title: string;
  rows: PricingSizeGuideRowContent[];
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
  rentalTermsBody: string;
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
  eyebrow: "Reliable dumpster rental made simple",
  headlineLine1: "Dumpster Rentals Made Easy",
  headlineLine2: null,
  subheadline: "Find the right dumpster for your project with clear rental details and an easy booking flow.",
  imageUrl: "/hero-dumpster.png",
  imageAlt: "Roll-off dumpster rental service",
  availabilityHelper: "Get instant pricing and availability in your area.",
  trustItems: ["Easy booking", "Clear rental details", "Helpful service"],
};

const HOME_SERVICE_AREA_FALLBACK: HomeServiceAreaContent = {
  modalTitle: "Service area",
  modalIntro: "Check available ZIP codes for this business.",
  coverageHeading: "Currently covered ZIP codes",
  regionList: [],
  coverageFootnote: "",
  unsupportedZipMessage: "We don’t currently serve ZIP",
  viewServiceAreaLabel: "View service area",
  closeLabel: "Got it",
};

const HOME_STATS_BAR_FALLBACK: HomeStatsBarContent = {
  enabled: false,
  items: [
    {
      id: "delivery-details",
      icon: "truck",
      text: "",
      sort_order: 1,
      active: true,
    },
    {
      id: "rental-details",
      icon: "tag",
      text: "",
      sort_order: 2,
      active: true,
    },
    {
      id: "customer-support",
      icon: "home",
      text: "",
      sort_order: 3,
      active: true,
    },
  ],
};

const HOME_DUMPSTER_SIZES_FALLBACK: HomeDumpsterSizesContent = {
  enabled: true,
  eyebrow: "Choose your size",
  title: "Pick the right dumpster",
  intro: "Compare common dumpster details and choose the size that fits your project.",
  items: [
    {
      id: "14-yard",
      sizeYards: 14,
      title: "Common starter size",
      shortDescription: "A reusable starter item for common residential projects.",
      longDescription: "Confirm the details for this dumpster size before booking.",
      checklistItems: [
        "Home cleanouts",
        "Yard waste",
        "Estate cleanouts",
        "Renovation debris",
        "Roofing shingles",
        "Garage & basement",
      ],
      dimensions: "14′ × 7.5′ × 4.5′",
      weightIncluded: "Weight allowance varies",
      rentalWindowDays: null,
      badgeLabel: "",
      isFeatured: true,
    },
  ],
};

const HOME_SERVICE_AREA_LOOKUP_FALLBACK: HomeServiceAreaLookupContent = {
  enabled: false,
  eyebrow: "SERVICE AREA",
  headline: "Check service availability",
  description: "Enter your ZIP code to check service availability.",
  zipPlaceholder: "Enter ZIP code",
  buttonText: "Check ZIP",
  areasEyebrow: "SERVICE AREAS",
  areaPills: [],
  helperText: "",
};

const DEFAULT_CARD_GRID_ICON_KEYS = ["tag", "truck", "home"] satisfies HomeStatsIconKey[];
const DEFAULT_STEPS_ICON_KEYS = ["calendar", "mapPin", "checkCircle"] satisfies HomeStatsIconKey[];

function getDefaultMarketingIconKey(
  type: "card_grid" | "steps",
  index: number,
): HomeStatsIconKey {
  const defaults = type === "card_grid" ? DEFAULT_CARD_GRID_ICON_KEYS : DEFAULT_STEPS_ICON_KEYS;
  return defaults[index] ?? "star";
}

const HOME_VALUE_PROPS_FALLBACK: HomeValuePropsContent = {
  sectionTitle: "Why choose us?",
  intro: "Use this section to highlight what makes your dumpster service easy to book and manage.",
  items: [
    {
      title: "Clear rental details",
      headline: "Help customers know what to expect",
      body: "Explain pricing, timing, and rental terms in straightforward language.",
      icon: "tag",
    },
    {
      title: "Delivery coordination",
      headline: "Plan delivery and pickup",
      body: "Describe how customers choose dates and prepare the drop-off location.",
      icon: "truck",
    },
    {
      title: "Responsive service",
      headline: "Guide customers through the job",
      body: "Share how your team supports customers before, during, and after the rental.",
      icon: "home",
    },
  ],
};

const HOME_HOW_IT_WORKS_FALLBACK: HomeHowItWorksContent = {
  sectionTitle: "How it works",
  intro: "A simple rental flow from delivery planning through pickup.",
  items: [
    {
      stepLabel: "Step 1",
      title: "Pick your delivery date",
      body: "Submit a preferred date and confirm availability through the booking flow.",
      icon: "calendar",
    },
    {
      stepLabel: "Step 2",
      title: "Plan the drop-off",
      body: "Add placement notes so delivery details are clear before the job starts.",
      icon: "mapPin",
    },
    {
      stepLabel: "Step 3",
      title: "Fill it, then request pickup",
      body: "Follow the configured pickup process when the dumpster is ready to be removed.",
      icon: "checkCircle",
    },
  ],
  footnote: "Included weight allowances and rental rules vary by configured dumpster size.",
};

const HOME_FAQ_FALLBACK: HomeFaqContent = {
  headline: "FAQs",
  intro: "Quick answers to the most common questions.",
  items: [
    {
      question: "What’s included in the flat-rate price?",
      answer:
        "Included services, rental length, and weight allowance depend on this business's configured pricing.",
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
        "Common restricted items can include tires, batteries, paint, chemicals, and certain electronics. Check the business's rules before booking.",
    },
    {
      question: "How fast can you deliver?",
      answer:
        "Delivery timing depends on local availability and schedule capacity. Enter your ZIP code to check available options.",
    },
  ],
};

const PRICING_INTRO_FALLBACK: PricingIntroContent = {
  headline: "Dumpster Pricing",
  defaultBody: "Review available dumpster sizes and rental details.",
};

const PRICING_PROMISES_FALLBACK: PricingPromisesContent = {
  productBody:
    "Base pricing and included services are shown with each available dumpster size.",
  dimensionLabel: "Dimensions vary by size",
  featureList: ["Included weight shown by dumpster size"],
  includedHeading: "What’s included in your rental",
  includedPricePrefix: "All included in the",
  includedPriceSuffix: "flat rate",
  includedItems: [
    "Delivery and pickup details",
    "Included weight shown by dumpster size",
    "Rental period shown at booking",
  ],
  footnote: "Additional charges may apply according to configured pricing.",
};

const PRICING_SIZE_GUIDE_FALLBACK: PricingSizeGuideContent = {
  enabled: true,
  buttonText: "Not sure which size? →",
  title: "Which size is right for me?",
  rows: [
    {
      id: "14-yard",
      sizeLabel: "14-yard",
      truckLoadEstimate: "~3-4 truck loads",
      description: "Bathroom remodel, small cleanout, garage declutter, or a single room renovation.",
      sortOrder: 10,
      active: true,
    },
    {
      id: "20-yard",
      sizeLabel: "20-yard",
      truckLoadEstimate: "~6-8 truck loads",
      description: "Roofing job, kitchen remodel, basement or attic cleanout, multi-room renovation.",
      sortOrder: 20,
      active: true,
    },
    {
      id: "30-yard",
      sizeLabel: "30-yard",
      truckLoadEstimate: "~9-12 truck loads",
      description: "Large home renovation, new construction debris, full property cleanout.",
      sortOrder: 30,
      active: true,
    },
    {
      id: "50-yard",
      sizeLabel: "50-yard",
      truckLoadEstimate: "~16-18 truck loads",
      description: "Commercial jobs, major demolition, large construction sites, industrial cleanouts.",
      sortOrder: 40,
      active: true,
    },
  ],
};

const SUPPORT_MARKETING_FALLBACK: SupportMarketingContent = {
  headline: "Ready to book your dumpster?",
  body: "Check availability and review rental details before booking.",
  primaryContactCtaLabel: null,
  responseTimeCopy: null,
};
const SUPPORT_MARKETING_LEGACY_BODY =
  "Check availability in your area — fast delivery, honest pricing, and friendly local support.";

const PRODUCT_MARKETING_FALLBACK: ProductMarketingContent = {
  badge: "",
  headline: "Dumpster rental",
  description: "Review the available size, rental details, and included services before booking.",
  highlightBullets: ["Great for cleanouts", "Small remodels", "Flooring & furniture"],
  dimensionsLabel: "Dimensions vary by size",
  helperText: "Choose the available option that fits your project.",
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
  serviceAreaNotice: "Enter your ZIP code to confirm service availability.",
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
  title: "Choose a delivery day",
  description: "Availability is visible up front, so the next opening is easy to spot.",
  earliestAvailablePrefix: "Earliest available delivery:",
  holdNoteTemplate: "We'll hold your selected dates for {minutes} minutes while you finish booking.",
  footerNote: "Unavailable dates cannot be booked online. Availability updates automatically as inventory changes.",
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
  title: "Review Your Booking",
  description: "Review your details. We’ll finalize everything on the next step.",
  reorderTitle: "New booking based on a previous rental",
  holdBannerTitle: "{time} left to complete your booking",
  holdBannerBody: "We're holding your dumpster while you finish your booking.",
  capLoadingText: "Checking availability limits…",
  deliveryTimeNote: "We'll contact you with a delivery window.",
  pickupWindowTemplate: "Pickup must be scheduled between {min} and {max}. Dates outside this window are unavailable.",
  rentalTermsBody: RENTAL_TERMS_CONSENT_TEXT,
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

function asEditableString(value: unknown, fallback: string) {
  if (value === undefined || value === null) return fallback;
  return typeof value === "string" ? value.trim() : fallback;
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

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function asNullableNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
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
    imageUrl: asString(raw.imageUrl, HOME_HERO_FALLBACK.imageUrl),
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

export async function getHomeStatsBarContent(
  options?: TenantContentReadOptions,
): Promise<HomeStatsBarContent> {
  const value = await getTenantContent("content.home.stats_bar", options);

  if (value === undefined) {
    return HOME_STATS_BAR_FALLBACK;
  }

  const raw = asObject(value);
  const items = asRecordArray(raw.items).map((item, index) => ({
    id: asString(item.id, `stat-${index + 1}`),
    text: asString(item.text, ""),
    icon: normalizeHomeStatsIconKey(item.icon),
    sort_order: asNumber(item.sort_order ?? item.sortOrder, index + 1),
    active: asBoolean(item.active, true),
  }));

  return {
    enabled: asBoolean(raw.enabled, true),
    items,
  };
}

export async function getHomeDumpsterSizesContent(
  options?: TenantContentReadOptions,
): Promise<HomeDumpsterSizesContent> {
  const value = await getTenantContent("content.home.dumpster_sizes", options);

  if (value === undefined) {
    return HOME_DUMPSTER_SIZES_FALLBACK;
  }

  const raw = asObject(value);
  const source = Array.isArray(raw.dumpsterSizes)
    ? raw.dumpsterSizes
    : Array.isArray(raw.items)
      ? raw.items
      : [];
  const fallbackItem = HOME_DUMPSTER_SIZES_FALLBACK.items[0];
  const intro =
    typeof raw.dumpsterSizesIntro === "string"
      ? raw.dumpsterSizesIntro.trim()
      : typeof raw.intro === "string"
        ? raw.intro.trim()
        : HOME_DUMPSTER_SIZES_FALLBACK.intro;
  const items = source
    .map(asObject)
    .flatMap<HomeDumpsterSizeContent>((item, index) => {
      const fallback = HOME_DUMPSTER_SIZES_FALLBACK.items[index] ?? fallbackItem;
      const sizeYards = asNullableNumber(item.sizeYards ?? item.yards, fallback.sizeYards);

      if (!sizeYards || sizeYards <= 0) return [];

      const checklistItems = asStringArray(item.checklistItems ?? item.commonUses, fallback.checklistItems)
        .map((checklistItem) => checklistItem.trim())
        .filter(Boolean);

      return [
        {
          id: asString(item.id, `dumpster-size-${index + 1}`),
          sizeYards,
          title: asString(item.title, fallback.title),
          shortDescription: asString(item.shortDescription, fallback.shortDescription),
          longDescription: asString(item.longDescription, fallback.longDescription),
          checklistItems,
          dimensions: asString(item.dimensions, fallback.dimensions),
          weightIncluded: asString(item.weightIncluded, fallback.weightIncluded),
          rentalWindowDays: asNullableNumber(item.rentalWindowDays, fallback.rentalWindowDays),
          badgeLabel: asString(item.badgeLabel, fallback.badgeLabel),
          isFeatured: asBoolean(item.isFeatured, fallback.isFeatured),
        },
      ];
    });

  return {
    enabled: asBoolean(raw.showDumpsterSizesSection ?? raw.enabled, HOME_DUMPSTER_SIZES_FALLBACK.enabled),
    eyebrow: asEditableString(raw.dumpsterSizesEyebrow ?? raw.eyebrow, HOME_DUMPSTER_SIZES_FALLBACK.eyebrow),
    title: asEditableString(raw.dumpsterSizesTitle ?? raw.title, HOME_DUMPSTER_SIZES_FALLBACK.title),
    intro,
    items,
  };
}

export async function getHomeServiceAreaLookupContent(
  options?: TenantContentReadOptions,
): Promise<HomeServiceAreaLookupContent> {
  const value = await getTenantContent("content.home.service_area_lookup", options);

  if (value === undefined) {
    return HOME_SERVICE_AREA_LOOKUP_FALLBACK;
  }

  const raw = asObject(value);

  return {
    enabled: asBoolean(raw.enabled, true),
    eyebrow: asString(raw.eyebrow, HOME_SERVICE_AREA_LOOKUP_FALLBACK.eyebrow),
    headline: asString(raw.headline, HOME_SERVICE_AREA_LOOKUP_FALLBACK.headline),
    description: asString(raw.description, HOME_SERVICE_AREA_LOOKUP_FALLBACK.description),
    zipPlaceholder: asString(raw.zipPlaceholder, HOME_SERVICE_AREA_LOOKUP_FALLBACK.zipPlaceholder),
    buttonText: asString(raw.buttonText, HOME_SERVICE_AREA_LOOKUP_FALLBACK.buttonText),
    areasEyebrow: asString(raw.areasEyebrow, HOME_SERVICE_AREA_LOOKUP_FALLBACK.areasEyebrow),
    areaPills: asStringArray(raw.areaPills ?? raw.areas, HOME_SERVICE_AREA_LOOKUP_FALLBACK.areaPills),
    helperText: asString(raw.helperText, HOME_SERVICE_AREA_LOOKUP_FALLBACK.helperText),
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
            icon: normalizeHomeStatsIconKey(record.icon ?? fallback.icon),
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
    .flatMap<HomeFlexibleSectionContent>((item, index) => {
      const type = asString(item.type, "");

      if (type === "card_grid") {
        return [
          {
            id: asString(item.id, `card-grid-${index + 1}`),
            type: "card_grid" as const,
            caption: asString(item.caption, ""),
            sectionTitle: asString(item.sectionTitle, HOME_VALUE_PROPS_FALLBACK.sectionTitle),
            intro: asString(item.intro, HOME_VALUE_PROPS_FALLBACK.intro),
            items: asRecordArray(item.items).map((entry, itemIndex) => {
              const fallback =
                HOME_VALUE_PROPS_FALLBACK.items[itemIndex] ?? HOME_VALUE_PROPS_FALLBACK.items[0];

              return {
                label: asString(entry.label ?? entry.title, fallback.title),
                headline: asString(entry.headline, fallback.headline),
                body: asString(entry.body, fallback.body),
                icon: normalizeHomeStatsIconKey(
                  entry.icon ?? fallback.icon ?? getDefaultMarketingIconKey("card_grid", itemIndex),
                ),
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
            caption: asString(item.caption, ""),
            sectionTitle: asString(item.sectionTitle, HOME_HOW_IT_WORKS_FALLBACK.sectionTitle),
            intro: asString(item.intro, HOME_HOW_IT_WORKS_FALLBACK.intro),
            items: asRecordArray(item.items).map((entry, itemIndex) => {
              const fallback =
                HOME_HOW_IT_WORKS_FALLBACK.items[itemIndex] ?? HOME_HOW_IT_WORKS_FALLBACK.items[0];

              return {
                label: asString(entry.label ?? entry.stepLabel, fallback.stepLabel),
                title: asString(entry.title, fallback.title),
                body: asString(entry.body, fallback.body),
                icon: normalizeHomeStatsIconKey(
                  entry.icon ?? fallback.icon ?? getDefaultMarketingIconKey("steps", itemIndex),
                ),
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
      caption: "",
      sectionTitle: valueProps.sectionTitle,
      intro: valueProps.intro,
      items: valueProps.items.map((item) => ({
        label: item.title,
        headline: item.headline,
        body: item.body,
        icon: item.icon,
      })),
    },
    {
      id: "how-it-works",
      type: "steps",
      caption: "",
      sectionTitle: howItWorks.sectionTitle,
      intro: howItWorks.intro,
      items: howItWorks.items.map((item) => ({
        label: item.stepLabel,
        title: item.title,
        body: item.body,
        icon: item.icon,
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
              icon: normalizeHomeStatsIconKey(record.icon ?? fallback.icon),
            };
          })
        : HOME_HOW_IT_WORKS_FALLBACK.items,
    footnote: asString(raw.footnote, HOME_HOW_IT_WORKS_FALLBACK.footnote),
  };
}

export async function getHomeFaqContent(
  options?: TenantContentReadOptions,
): Promise<HomeFaqContent> {
  const value = await getTenantContent("content.faq.home", options);
  const raw = asObject(value);
  const items = Array.isArray(raw.items) ? raw.items : [];
  const intro =
    value === undefined
      ? HOME_FAQ_FALLBACK.intro
      : typeof raw.intro === "string"
        ? raw.intro.trim()
        : HOME_FAQ_FALLBACK.intro;

  return {
    headline: asString(raw.headline, HOME_FAQ_FALLBACK.headline),
    intro,
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

export async function getPricingSizeGuideContent(
  options?: TenantContentReadOptions,
): Promise<PricingSizeGuideContent> {
  const raw = asObject(await getTenantContent("content.pricing.product_content", options));
  const rawSizeGuide = asObject(raw.sizeGuide);
  const sourceRows = asRecordArray(rawSizeGuide.rows);
  const fallbackRows = PRICING_SIZE_GUIDE_FALLBACK.rows;
  const rows = (sourceRows.length ? sourceRows : fallbackRows)
    .map((item, index) => {
      const row = asObject(item);
      const fallback = fallbackRows[index] ?? fallbackRows[0];

      return {
        id: asString(row.id, `size-guide-row-${index + 1}`),
        sizeLabel: asString(row.sizeLabel, fallback.sizeLabel),
        truckLoadEstimate: asString(row.truckLoadEstimate, fallback.truckLoadEstimate),
        description: asString(row.description, fallback.description),
        sortOrder: asNumber(row.sortOrder ?? row.sort_order, fallback.sortOrder),
        active: asBoolean(row.active, fallback.active),
      };
    })
    .filter((row) => row.active && row.sizeLabel && row.description)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.sizeLabel.localeCompare(right.sizeLabel);
    });

  return {
    enabled: asBoolean(rawSizeGuide.enabled, PRICING_SIZE_GUIDE_FALLBACK.enabled),
    buttonText: asString(rawSizeGuide.buttonText, PRICING_SIZE_GUIDE_FALLBACK.buttonText),
    title: asString(rawSizeGuide.title, PRICING_SIZE_GUIDE_FALLBACK.title),
    rows,
  };
}

export async function getSupportMarketingContent(
  options?: TenantContentReadOptions,
): Promise<SupportMarketingContent> {
  const raw = asObject(await getTenantContent("content.support.marketing", options));
  const body = asString(raw.body, SUPPORT_MARKETING_FALLBACK.body);

  return {
    headline: asString(raw.headline, SUPPORT_MARKETING_FALLBACK.headline),
    body: body === SUPPORT_MARKETING_LEGACY_BODY ? SUPPORT_MARKETING_FALLBACK.body : body,
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
  options?: TenantContentReadOptions,
): Promise<ProductMarketingContent> {
  const raw = asObject(
    await getTenantContent(`content.catalog.product_marketing.${productId}`, options),
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

export async function getBookingEntryContent(
  options?: TenantContentReadOptions,
): Promise<BookingEntryContent> {
  const raw = asObject(await getTenantContent("content.booking.entry", options));

  return {
    title: asString(raw.title, BOOKING_ENTRY_FALLBACK.title),
    subtitle: asString(raw.subtitle, BOOKING_ENTRY_FALLBACK.subtitle),
    sectionTitle: asString(raw.sectionTitle, BOOKING_ENTRY_FALLBACK.sectionTitle),
    sectionDescription: asString(raw.sectionDescription, BOOKING_ENTRY_FALLBACK.sectionDescription),
    blockedCtaText: asString(raw.blockedCtaText, BOOKING_ENTRY_FALLBACK.blockedCtaText),
  };
}

export async function getBookingAddressContent(
  options?: TenantContentReadOptions,
): Promise<BookingAddressContent> {
  const raw = asObject(await getTenantContent("content.booking.address", options));

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

export async function getBookingDateContent(
  options?: TenantContentReadOptions,
): Promise<BookingDateContent> {
  const raw = asObject(await getTenantContent("content.booking.date", options));
  const title = asString(raw.title, BOOKING_DATE_FALLBACK.title);
  const earliestAvailablePrefix = asString(
    raw.earliestAvailablePrefix,
    BOOKING_DATE_FALLBACK.earliestAvailablePrefix,
  );
  const footerNote = asString(raw.footerNote, BOOKING_DATE_FALLBACK.footerNote);

  return {
    title: title.trim() === "Choose an open delivery day" ? BOOKING_DATE_FALLBACK.title : title,
    description: asString(raw.description, BOOKING_DATE_FALLBACK.description),
    earliestAvailablePrefix:
      earliestAvailablePrefix.trim() === "Earliest available:"
        ? BOOKING_DATE_FALLBACK.earliestAvailablePrefix
        : earliestAvailablePrefix,
    holdNoteTemplate: asString(raw.holdNoteTemplate, BOOKING_DATE_FALLBACK.holdNoteTemplate),
    footerNote:
      footerNote.trim() === "Disabled dates are not bookable online. Availability updates automatically as inventory changes."
        ? BOOKING_DATE_FALLBACK.footerNote
        : footerNote,
    nextAvailablePrefix: asString(raw.nextAvailablePrefix, BOOKING_DATE_FALLBACK.nextAvailablePrefix),
    availabilityError: asString(raw.availabilityError, BOOKING_DATE_FALLBACK.availabilityError),
  };
}

export async function getBookingPlacementContent(
  options?: TenantContentReadOptions,
): Promise<BookingPlacementContent> {
  const raw = asObject(await getTenantContent("content.booking.placement", options));

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

export async function getBookingPickupContent(
  options?: TenantContentReadOptions,
): Promise<BookingPickupContent> {
  const raw = asObject(await getTenantContent("content.booking.pickup", options));

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

export async function getBookingSummaryContent(
  options?: TenantContentReadOptions,
): Promise<BookingSummaryContent> {
  const raw = asObject(await getTenantContent("content.booking.summary", options));

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

export async function getBookingConfirmContent(
  options?: TenantContentReadOptions,
): Promise<BookingConfirmContent> {
  const [confirmValue, termsValue] = await Promise.all([
    getTenantContent("content.booking.confirm", options),
    getTenantContent("content.terms.rental_terms", options),
  ]);
  const raw = asObject(confirmValue);
  const termsRaw = asObject(termsValue);
  const title = asString(raw.title, BOOKING_CONFIRM_FALLBACK.title);
  const deliveryTimeNote = asString(raw.deliveryTimeNote, BOOKING_CONFIRM_FALLBACK.deliveryTimeNote);
  const normalizedDeliveryTimeNote =
    deliveryTimeNote === "We’ll contact you with the exact delivery time." ||
    deliveryTimeNote === "We'll contact you with the exact delivery time."
      ? BOOKING_CONFIRM_FALLBACK.deliveryTimeNote
      : deliveryTimeNote;

  return {
    title: title === "Confirm Your Booking" ? BOOKING_CONFIRM_FALLBACK.title : title,
    description: asString(raw.description, BOOKING_CONFIRM_FALLBACK.description),
    reorderTitle: asString(raw.reorderTitle, BOOKING_CONFIRM_FALLBACK.reorderTitle),
    holdBannerTitle: asString(raw.holdBannerTitle, BOOKING_CONFIRM_FALLBACK.holdBannerTitle),
    holdBannerBody: asString(raw.holdBannerBody, BOOKING_CONFIRM_FALLBACK.holdBannerBody),
    capLoadingText: asString(raw.capLoadingText, BOOKING_CONFIRM_FALLBACK.capLoadingText),
    deliveryTimeNote: normalizedDeliveryTimeNote,
    pickupWindowTemplate: asString(
      raw.pickupWindowTemplate,
      BOOKING_CONFIRM_FALLBACK.pickupWindowTemplate,
    ),
    rentalTermsBody: asString(
      termsRaw.body ?? termsRaw.termsAndConditionsBody ?? termsRaw.terms_and_conditions_body,
      BOOKING_CONFIRM_FALLBACK.rentalTermsBody,
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

export async function getBookingCheckoutContent(
  options?: TenantContentReadOptions,
): Promise<BookingCheckoutContent> {
  const raw = asObject(await getTenantContent("content.booking.checkout", options));

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

export async function getBookingSuccessContent(
  options?: TenantContentReadOptions,
): Promise<BookingSuccessContent> {
  const raw = asObject(await getTenantContent("content.booking.success", options));

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
