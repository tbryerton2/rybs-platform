import { formatUsdFromCents } from "../money.ts";
import { formatDateTimeET } from "../time.ts";

export type PostBookingChargeType =
  | "weight_overage"
  | "damage"
  | "extra_day"
  | "trip_fee"
  | "prohibited_material"
  | "manual_adjustment";

export type BuildPostBookingChargePaidEmailInput = {
  businessName: string;
  businessPhone?: string | null;
  businessEmail?: string | null;
  customerName?: string | null;
  bookingReference?: string | null;
  chargeType: PostBookingChargeType;
  chargeDescription: string;
  amountCents: number;
  currency?: string | null;
  paidAt: string | Date;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type BuiltPostBookingChargePaidEmail = {
  subject: string;
  body: string;
};

const CHARGE_TYPE_LABELS: Record<PostBookingChargeType, string> = {
  weight_overage: "Weight overage",
  damage: "Damage fee",
  extra_day: "Extra rental day",
  trip_fee: "Trip fee",
  prohibited_material: "Prohibited material fee",
  manual_adjustment: "Adjustment",
};

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function formatAmount(amountCents: number, currency: string) {
  if (currency === "USD") return formatUsdFromCents(amountCents);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = clean(value)?.toUpperCase() ?? "USD";
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function formatCardLine(cardBrand: string | null, cardLast4: string | null) {
  if (!cardBrand || !cardLast4) return null;
  return `Card: ${cardBrand.toUpperCase()} ending ${cardLast4}`;
}

export function getPostBookingChargeTypeLabel(chargeType: PostBookingChargeType) {
  return CHARGE_TYPE_LABELS[chargeType];
}

export function buildPostBookingChargePaidEmail(
  input: BuildPostBookingChargePaidEmailInput,
): BuiltPostBookingChargePaidEmail {
  const businessName = clean(input.businessName) ?? "Our team";
  const customerName = clean(input.customerName);
  const bookingReference = clean(input.bookingReference);
  const currency = normalizeCurrency(input.currency);
  const amount = formatAmount(input.amountCents, currency);
  const paidDate = formatDateTimeET(input.paidAt);
  const chargeTypeLabel = CHARGE_TYPE_LABELS[input.chargeType];
  const cardLine = formatCardLine(clean(input.cardBrand), clean(input.cardLast4));
  const businessPhone = clean(input.businessPhone);
  const businessEmail = clean(input.businessEmail);
  const contactParts = [businessPhone, businessEmail].filter(Boolean);
  const contactLine = contactParts.length
    ? `Questions? Contact ${businessName} at ${contactParts.join(" or ")}.`
    : `Questions? Contact ${businessName}.`;

  const greeting = customerName ? `Hi ${customerName},` : "Hi,";
  const referenceLine = bookingReference ? [`Booking reference: ${bookingReference}`] : [];
  const cardLines = cardLine ? [cardLine] : [];

  return {
    subject: bookingReference
      ? `Additional charge for your dumpster rental ${bookingReference}`
      : "Additional charge for your dumpster rental",
    body: [
      greeting,
      "",
      `${businessName} charged ${amount} for an additional rental charge.`,
      "",
      ...referenceLine,
      `Charge type: ${chargeTypeLabel}`,
      `Amount: ${amount}`,
      `Paid: ${paidDate}`,
      ...cardLines,
      "",
      "This charge was made under the card-on-file authorization accepted during checkout for documented additional charges related to this rental.",
      "",
      contactLine,
    ].join("\n"),
  };
}
