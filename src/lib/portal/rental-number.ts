export function getPortalRentalShortId(bookingId: string) {
  return bookingId.slice(0, 8);
}

export function getPortalRentalLabel(bookingId: string) {
  return `Rental #${getPortalRentalShortId(bookingId)}`;
}
