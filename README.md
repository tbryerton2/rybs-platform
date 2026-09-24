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
