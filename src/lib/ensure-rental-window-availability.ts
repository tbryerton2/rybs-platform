export type RentalWindowAvailabilityCheckResult = {
  remaining: number;
};

type EnsureRentalWindowAvailabilityInput = {
  check: () => Promise<RentalWindowAvailabilityCheckResult>;
  unavailableMessage?: string;
};

export async function ensureRentalWindowAvailability({
  check,
  unavailableMessage = "That rental window is unavailable.",
}: EnsureRentalWindowAvailabilityInput) {
  const availability = await check();

  if (availability.remaining <= 0) {
    throw new Error(unavailableMessage);
  }

  return availability;
}
