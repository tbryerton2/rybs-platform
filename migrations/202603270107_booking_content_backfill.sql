with resolved_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
)
insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select resolved_tenant.id, seeded.key, 'published', seeded.value_json
from resolved_tenant
cross join (
  values
    (
      'content.catalog.product_marketing.default',
      jsonb_build_object(
        'badge', 'Most Popular',
        'headline', '14-Foot Dumpster',
        'description', 'Includes delivery, pickup & standard weight allowance. No hidden fees.',
        'highlightBullets', to_jsonb(array['Great for cleanouts', 'Small remodels', 'Flooring & furniture']::text[]),
        'dimensionsLabel', '7'' × 14'' × 4''',
        'helperText', 'One simple option to keep booking fast.'
      )
    ),
    (
      'content.booking.entry',
      jsonb_build_object(
        'title', 'Book Your Dumpster',
        'subtitle', 'Dumpster selection',
        'sectionTitle', 'Choose your dumpster',
        'sectionDescription', 'One simple option to keep booking fast.',
        'blockedCtaText', 'Enter a serviced ZIP to continue'
      )
    ),
    (
      'content.booking.address',
      jsonb_build_object(
        'title', 'Delivery Address',
        'description', 'Add your contact info and service address to get started.',
        'serviceAreaNotice', 'We currently service Onondaga and Madison Counties, NY.',
        'savedLocationsTitle', 'Use a saved location',
        'savedLocationsDescription', 'Start with your default location or pick another saved address, then update anything you need below.',
        'savedLocationsManageLabel', 'Manage saved locations',
        'bookingDetailsTitle', 'Booking details',
        'bookingDetailsDescription', 'This is where we will deliver the dumpster and how we will contact you about the job.',
        'savedLocationIntro', 'Using this saved location as the starting point for this booking.',
        'savedLocationFootnote', 'Editing these details later only changes this booking. It does not update the saved location automatically.',
        'zipIdleHelper', 'Enter a ZIP, then tap Save ZIP.',
        'zipValidTemplate', 'Service available in {town}, {county} County.',
        'unsupportedZipMessage', 'We don’t currently offer online booking for that ZIP. Please enter a supported ZIP to continue.'
      )
    ),
    (
      'content.booking.date',
      jsonb_build_object(
        'title', 'Choose an open delivery day',
        'description', 'Availability is visible up front, so the next opening is easy to spot.',
        'earliestAvailablePrefix', 'Earliest available:',
        'holdNoteTemplate', 'Note: Continuing will create a temporary {minutes}-minute hold.',
        'footerNote', 'Disabled dates are not bookable online. Availability updates automatically as inventory changes.',
        'nextAvailablePrefix', 'Next available delivery date:',
        'availabilityError', 'Could not load calendar availability.'
      )
    ),
    (
      'content.booking.placement',
      jsonb_build_object(
        'title', 'Placement & access',
        'description', 'Tell us where to place the dumpster. We will only ask for extra details if needed.',
        'addressSummaryPrefix', 'Delivery address:',
        'tipsLabel', 'Delivery tips:',
        'tipsSummary', 'Clear cars, watch low branches/wires, choose a flat accessible area.',
        'tipsExpanded', 'Street placement may require a permit in some municipalities. If you will not be home, be specific and add a photo if it helps show the driver exactly where to place the dumpster.',
        'streetPermitNotice', 'Street placement may require a local permit depending on your municipality.',
        'placementExample', 'Example: right side of driveway near the garage.',
        'optionalDetailsTitle', 'Optional details',
        'optionalDetailsDescription', 'Only add these if they help us deliver more accurately.',
        'accessQuestion', 'Anything that could make delivery tricky?',
        'accessSimpleOption', 'No, access is straightforward',
        'accessDetailedOption', 'Yes, there are a few details',
        'photoUploadingLabel', 'Uploading photo...',
        'photoFailedLabel', 'Photo upload failed. Please try again.'
      )
    ),
    (
      'content.booking.pickup',
      jsonb_build_object(
        'title', 'Book Your Dumpster',
        'subtitle', 'Pickup preference',
        'requestOptionTitle', 'Request pickup when ready',
        'requestOptionDescription', 'Most customers choose this.',
        'scheduledOptionTitle', 'Schedule pickup date',
        'scheduledOptionDescription', 'Choose a specific date if you need it removed by a deadline.',
        'pickupDateLabel', 'Pickup date'
      )
    ),
    (
      'content.booking.summary',
      jsonb_build_object(
        'title', 'Book Your Dumpster',
        'subtitle', 'Price summary',
        'locationSummaryTitle', 'Service address (v1)',
        'locationEmptyText', 'No ZIP saved yet. Please go back and validate your ZIP.',
        'totalLabel', 'Flat-rate total (prepay)',
        'includedTitle', 'What’s included',
        'includedItems', to_jsonb(array['Delivery & pickup', 'Standard rental period included', '2.5 tons included']::text[]),
        'weightPolicyTitle', 'Included Weight Policy',
        'weightPolicyBody', 'Your flat rate includes up to 2.5 tons. Overages are billed only if exceeded.',
        'weightPolicyFootnote', 'Most homeowners stay under the included weight.',
        'checkoutCtaLabel', 'Proceed to Secure Payment',
        'missingZipCtaLabel', 'Go validate ZIP'
      )
    ),
    (
      'content.booking.confirm',
      jsonb_build_object(
        'title', 'Confirm Your Booking',
        'description', 'Review your details. We’ll finalize everything on the next step.',
        'reorderTitle', 'New booking based on a previous rental',
        'holdBannerTitle', 'Your delivery date is being held. Time left: {time}',
        'holdBannerBody', 'If this timer hits 00:00, you’ll need to choose a new date.',
        'capLoadingText', 'Checking availability limits…',
        'deliveryTimeNote', 'We’ll contact you with the exact delivery time.',
        'pickupWindowTemplate', 'Pickup must be scheduled between {min} and {max}. Dates outside this window are unavailable.',
        'pickupLaterTitle', 'I’ll schedule pickup later',
        'pickupLaterDescription', 'You’ll get a confirmation link where you can request pickup anytime.',
        'pickupNowTitle', 'Schedule a pickup date now',
        'pickupEarliestPrefix', 'Earliest pickup:'
      )
    ),
    (
      'content.booking.checkout',
      jsonb_build_object(
        'title', 'Checkout',
        'description', 'Complete your booking.',
        'orderSummaryTitle', 'Order summary',
        'reorderTitle', 'New booking based on a previous rental',
        'deliveryTimeNote', 'We’ll contact you with the exact delivery time.',
        'pickupNotice', '24-hour notice required.',
        'paymentTitle', 'Payment',
        'paymentDescription', 'Secure payment processing. Your dumpster will be officially booked after successful payment.',
        'paymentIdleLabel', 'Simulate successful payment',
        'paymentLoadingLabel', 'Loading pricing...',
        'paymentProcessingLabel', 'Processing...',
        'paymentFooterNote', 'You will receive a confirmation email immediately after booking.',
        'holdExpiredNotice', 'Your delivery date hold has expired. Please go back and choose a new delivery date.',
        'chooseNewDateLabel', 'Choose a new delivery date'
      )
    ),
    (
      'content.booking.success',
      jsonb_build_object(
        'title', 'Booking confirmed',
        'description', 'Your dumpster has been reserved and we’ve created a new booking for you.',
        'bookingReferenceTitle', 'Booking reference',
        'linkedBookingTemplate', 'This booking is linked to {email}. Use that email to access your portal and manage this booking.',
        'orderSummaryTitle', 'Order summary',
        'confirmationEmailNote', 'You’ll receive a confirmation email shortly with your delivery details and booking reference.',
        'portalLoggedInCtaLabel', 'Go to my portal',
        'portalLoggedOutCtaLabel', 'Access my portal',
        'returnHomeCtaLabel', 'Return home'
      )
    )
) as seeded(key, value_json)
on conflict (tenant_id, key) do nothing;
