# RYBS Platform

RYBS Platform is the shared SaaS application for dumpster rental businesses.

Tan Can Man is tenant #1 on the platform. Demo Dumpster Company is the demo tenant used for demonstrations and multi-tenant validation. Future dumpster rental companies should be added as additional tenants, not as separate applications.

## Admin hostname

Production business and platform administration use one RYBS-owned origin:

```env
ADMIN_APP_URL=https://app.rybsoftware.com
# Set these to the verified RYBS-owned SES identity and its AWS region.
RYBS_MANAGED_SES_FROM_EMAIL=
RYBS_MANAGED_SES_REGION=
```

When configured, requests for `/admin/*` or `/platform-admin/*` on another hostname redirect to this origin. Admin invitations and password-recovery links also use it. Password recovery uses the RYBS-managed SES identity so it does not inherit a tenant's branding. Leave `ADMIN_APP_URL` unset in local and preview environments when those environments should keep using their current request hostname.

Add the exact production callback paths to the Supabase Auth redirect allowlist:

- `https://app.rybsoftware.com/admin/accept-invite`
- `https://app.rybsoftware.com/admin/update-password`
- `https://app.rybsoftware.com/platform-admin/auth/callback`

## Retail email replies

Retail emails keep their existing SES From address, display name, region, and
authentication. Reply-To uses the tenant identity's configured `reply_to_email`
first, then `tenant_settings` → `support.email`. External inboxes such as Gmail
are supported independently of SES sending-domain verification. Configure an
inbox monitored by the business; syntax validation does not prove inbox ownership.
Website-header addresses and private booking-notification recipients are not
reply fallbacks, and neither are global SES defaults or the From address.

When neither reply destination is usable, tenant email delivery fails before
calling SES. Confirmed bookings remain successful, with an email warning and a
failed `booking_messages` record containing the configuration error. The queue
worker also records a failed delivery without reversing a paid charge. These
failures are not automatically retried: correct configuration, then deliberately
retry the appropriate message. Portal login and staff invitation emails also
require a reply contact. Do not process the historical queue to test this change.
