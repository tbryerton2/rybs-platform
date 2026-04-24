# Admin Employees Model

`business_employees` stores business-managed employee records for the admin app.

- Each record belongs to one business. In the current codebase, that business scope maps to the existing `tenants` table.
- We soft-deactivate employees instead of deleting them so route history, audit history, and future rehire/account-link flows stay intact.
- `linked_user_id` is intentionally optional. An employee record can exist before any login or portal/admin account is provisioned.
- The shape is SaaS-ready because the ownership boundary is the business, not Tan Can Man-specific naming or assumptions.

This should eventually connect to the internal docs/settings explanation of identity and IDs so owners understand the difference between employee records, auth users, and any future employee login/access features.
