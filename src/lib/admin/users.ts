import "server-only";

import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  getAdminAuthRedirectRequestHost,
  getAdminAuthRedirectRequestProtocol,
  getAdminAuthRedirectUrl,
  type AdminAuthRedirectInput,
} from "@/lib/admin/auth-redirects";
import { buildAdminInviteAcceptanceUrl } from "@/lib/admin/invite-acceptance";
import {
  requireAdminBusinessOwner,
  type AdminMembershipRole,
} from "@/lib/admin/auth";
import { buildAdminUserInviteEmail } from "@/lib/email/templates/admin-user-invite";
import {
  resolveTenantEmailSender,
  tenantSenderSendEmailOptions,
  type TenantEmailSender,
} from "@/lib/email/tenant-sender";
import { sendEmail } from "@/lib/email/ses";
import { normalizeEmail } from "@/lib/identity";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTenantCommunicationSettings,
  getTenantPublicBaseUrl,
} from "@/lib/tenant/communications";
import type { TenantRecord } from "@/lib/tenant/server";

type BusinessAdminMembershipRow = {
  id: string;
  business_id: string;
  auth_user_id: string;
  role: AdminMembershipRole;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
};

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type AdminUserEmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  fromEmail?: string;
  fromDisplayName?: string | null;
  region?: string | null;
  useDefaultReplyTo?: boolean;
};

const ADMIN_USER_REQUEST_TIMEOUT_MS = 15_000;

export type BusinessAdminUser = {
  membershipId: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  role: AdminMembershipRole;
  status: "active" | "pending";
  createdAt: string;
  updatedAt: string;
  invitedAt: string | null;
  isCurrentUser: boolean;
};

export type BusinessAdminUserMutationErrorCode =
  | "invalid_input"
  | "owner_required"
  | "auth_user_not_found"
  | "membership_not_found"
  | "membership_rpc_missing"
  | "last_owner"
  | "self_update_blocked"
  | "not_pending"
  | "database_error";

export class BusinessAdminUserMutationError extends Error {
  code: BusinessAdminUserMutationErrorCode;

  constructor(code: BusinessAdminUserMutationErrorCode, message: string) {
    super(message);
    this.name = "BusinessAdminUserMutationError";
    this.code = code;
  }
}

async function withAdminUserRequestTimeout<T>(promise: PromiseLike<T>, operation: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new BusinessAdminUserMutationError(
              "database_error",
              `${operation} is taking longer than expected. Refresh Users to check whether it completed, then try again.`,
            ),
          );
        }, ADMIN_USER_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function normalizeBusinessAdminRole(value: unknown): AdminMembershipRole {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (role === "owner" || role === "admin") {
    return role;
  }

  throw new BusinessAdminUserMutationError("invalid_input", "Choose Owner or Admin.");
}

function normalizeMembershipId(value: unknown) {
  const membershipId = typeof value === "string" ? value.trim() : "";

  if (!membershipId) {
    throw new BusinessAdminUserMutationError("invalid_input", "Choose a user.");
  }

  return membershipId;
}

function normalizeConfirmationEmail(value: unknown) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

function roleLabel(role: AdminMembershipRole) {
  return role === "owner" ? "Owner" : "Admin";
}

function getUserName(user: User | undefined) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const name = typeof metadata?.name === "string" ? metadata.name.trim() : "";

  return fullName || name || null;
}

function isPendingInvite(user: User | undefined) {
  const invitedAt = user?.invited_at ?? null;
  const confirmedAt =
    (user as User & { confirmed_at?: string | null; email_confirmed_at?: string | null } | undefined)
      ?.confirmed_at ??
    (user as User & { email_confirmed_at?: string | null } | undefined)?.email_confirmed_at ??
    null;

  return Boolean(invitedAt && !confirmedAt);
}

async function listAuthUsersById() {
  const usersById = new Map<string, User>();
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await withAdminUserRequestTimeout(
      supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      }),
      "Listing admin users",
    );

    if (error) {
      throw new BusinessAdminUserMutationError(
        "database_error",
        `Could not list Supabase Auth users: ${error.message}`,
      );
    }

    for (const user of data.users ?? []) {
      usersById.set(user.id, user);
    }

    if ((data.users ?? []).length < perPage) {
      break;
    }
  }

  return usersById;
}

async function findAuthUserByExactEmail(email: string): Promise<User | null> {
  const usersById = await listAuthUsersById();

  for (const user of usersById.values()) {
    if (user.email?.trim().toLowerCase() === email) {
      return user;
    }
  }

  return null;
}

async function getRequestUrlContext(): Promise<AdminAuthRedirectInput> {
  const headerStore = await headers();

  return {
    adminAppUrl: process.env.ADMIN_APP_URL,
    forwardedHost: headerStore.get("x-forwarded-host"),
    host: headerStore.get("host"),
    forwardedProto: headerStore.get("x-forwarded-proto"),
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: process.env.NODE_ENV,
  };
}

function getTenantCommunicationRequestContext(input: AdminAuthRedirectInput) {
  const requestHost = getAdminAuthRedirectRequestHost(input);
  if (!requestHost) return {};

  return {
    host: requestHost,
    protocol: getAdminAuthRedirectRequestProtocol(requestHost, input),
  };
}

export function getAdminInviteRedirectUrl(input: AdminAuthRedirectInput) {
  return getAdminAuthRedirectUrl("/admin/accept-invite", input);
}

async function getAdminInviteRedirectTo(tenant: TenantRecord) {
  const requestContext = await getRequestUrlContext();
  const requestHost = getAdminAuthRedirectRequestHost(requestContext);
  const fallbackBaseUrl = requestHost ? null : await getTenantPublicBaseUrl(tenant);

  return getAdminInviteRedirectUrl({
    ...requestContext,
    fallbackBaseUrl,
  });
}

function mapDatabaseMutationError(error: SupabaseDbError): never {
  const message = error.message ?? "";

  if (
    error.code === "PGRST202" &&
    message.includes("business_admin_") &&
    message.includes("schema cache")
  ) {
    throw new BusinessAdminUserMutationError(
      "membership_rpc_missing",
      "Business user-management database functions are not installed. Apply the pending Supabase migration and try again.",
    );
  }

  if (message.includes("BUSINESS_ADMIN_OWNER_REQUIRED")) {
    throw new BusinessAdminUserMutationError(
      "owner_required",
      "Only active business owners can manage users.",
    );
  }

  if (message.includes("BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND")) {
    throw new BusinessAdminUserMutationError("membership_not_found", "Business user not found.");
  }

  if (message.includes("BUSINESS_ADMIN_LAST_OWNER")) {
    throw new BusinessAdminUserMutationError(
      "last_owner",
      "At least one active Owner is required.",
    );
  }

  if (message.includes("BUSINESS_ADMIN_SELF_UPDATE_BLOCKED")) {
    throw new BusinessAdminUserMutationError(
      "self_update_blocked",
      "You cannot change or remove your own business user access.",
    );
  }

  if (message.includes("BUSINESS_ADMIN_INVALID_ROLE")) {
    throw new BusinessAdminUserMutationError("invalid_input", "Choose Owner or Admin.");
  }

  if (message.includes("BUSINESS_ADMIN_INVALID_STATUS")) {
    throw new BusinessAdminUserMutationError("invalid_input", "Choose a valid status.");
  }

  console.error("[admin-users]", {
    event: "mutation_database_error",
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  throw new BusinessAdminUserMutationError(
    "database_error",
    "We could not update Users. Try again in a moment.",
  );
}

async function grantMembership(input: {
  actorAuthUserId: string;
  businessId: string;
  targetAuthUserId: string;
  role: AdminMembershipRole;
}) {
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.rpc("business_admin_grant_membership", {
      p_actor_auth_user_id: input.actorAuthUserId,
      p_business_id: input.businessId,
      p_target_auth_user_id: input.targetAuthUserId,
      p_role: input.role,
    }),
    "Granting admin access",
  );

  if (error) {
    mapDatabaseMutationError(error);
  }

  return String(data);
}

async function generateAdminInviteLink(email: string, tenant: TenantRecord) {
  const redirectTo = await getAdminInviteRedirectTo(tenant);
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
      },
    }),
    "Generating the admin invite",
  );

  if (error || !data.user || !data.properties?.hashed_token) {
    throw new BusinessAdminUserMutationError(
      "database_error",
      error?.message ?? "Supabase Auth did not return an invite link.",
    );
  }

  return {
    authUser: data.user,
    actionLink: buildAdminInviteAcceptanceUrl({
      redirectTo,
      businessId: tenant.id,
      tokenHash: data.properties.hashed_token,
      type: "invite",
    }),
  };
}

async function generateExistingUserAdminLink(email: string, tenant: TenantRecord) {
  const redirectTo = await getAdminInviteRedirectTo(tenant);
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo,
      },
    }),
    "Generating the admin sign-in link",
  );

  if (error || !data.user || !data.properties?.hashed_token) {
    throw new BusinessAdminUserMutationError(
      "database_error",
      error?.message ?? "Supabase Auth did not return a sign-in link.",
    );
  }

  return {
    authUser: data.user,
    actionLink: buildAdminInviteAcceptanceUrl({
      redirectTo,
      businessId: tenant.id,
      tokenHash: data.properties.hashed_token,
      type: "magiclink",
    }),
  };
}

async function sendTenantAdminInviteEmail(input: {
  email: string;
  actionLink: string;
  role: AdminMembershipRole;
  sender?: TenantEmailSender;
  sendEmailOverride?: (message: AdminUserEmailMessage) => Promise<unknown>;
}) {
  const session = await requireAdminBusinessOwner();
  const requestContext = getTenantCommunicationRequestContext(await getRequestUrlContext());
  const communication = await getTenantCommunicationSettings(session.business, requestContext);
  const sender =
    input.sender ??
    (await resolveTenantEmailSender({
      tenant: session.business,
      businessName: communication.businessName,
      supportEmail: communication.supportEmail,
    }));
  const senderOptions = tenantSenderSendEmailOptions(sender);
  const inviteEmail = buildAdminUserInviteEmail({
    businessName: communication.businessName,
    inviteUrl: input.actionLink,
    roleLabel: roleLabel(input.role),
    supportEmail: communication.supportEmail,
    supportPhone: communication.supportPhone,
  });
  const emailSender = input.sendEmailOverride ?? sendEmail;

  await emailSender({
    to: input.email,
    subject: inviteEmail.subject,
    text: inviteEmail.text,
    html: inviteEmail.html,
    ...senderOptions,
  });

  return sender;
}

export async function getBusinessAdminUsers() {
  const session = await requireAdminBusinessOwner();
  const [membershipResult, usersById] = await Promise.all([
    supabaseAdmin
      .from("business_admin_memberships")
      .select("id, business_id, auth_user_id, role, status, created_at, updated_at")
      .eq("business_id", session.business.id)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    listAuthUsersById(),
  ]);

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  const users: BusinessAdminUser[] = ((membershipResult.data ?? []) as BusinessAdminMembershipRow[]).map((row) => {
    const authUser = usersById.get(row.auth_user_id);
    const status: BusinessAdminUser["status"] = isPendingInvite(authUser) ? "pending" : "active";

    return {
      membershipId: row.id,
      authUserId: row.auth_user_id,
      name: getUserName(authUser),
      email: authUser?.email ?? null,
      role: row.role,
      status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      invitedAt: authUser?.invited_at ?? null,
      isCurrentUser: row.auth_user_id === session.user.id,
    };
  });

  return {
    users,
    activeOwnerCount: users.filter((user) => user.role === "owner" && user.status === "active").length,
    currentUserId: session.user.id,
  };
}

export async function inviteBusinessAdminUser(input: {
  email: unknown;
  role: unknown;
}) {
  const session = await requireAdminBusinessOwner();
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  const role = normalizeBusinessAdminRole(input.role);

  if (!email) {
    throw new BusinessAdminUserMutationError("invalid_input", "Enter a valid email address.");
  }

  let createdInviteUser = false;
  let authUser = await findAuthUserByExactEmail(email);
  let actionLink: string;

  if (authUser) {
    const generated = isPendingInvite(authUser)
      ? await generateAdminInviteLink(email, session.business)
      : await generateExistingUserAdminLink(email, session.business);
    authUser = generated.authUser;
    actionLink = generated.actionLink;
  } else {
    const generated = await generateAdminInviteLink(email, session.business);
    authUser = generated.authUser;
    actionLink = generated.actionLink;
    createdInviteUser = true;
  }

  let membershipId: string;

  try {
    membershipId = await grantMembership({
      actorAuthUserId: session.user.id,
      businessId: session.business.id,
      targetAuthUserId: authUser.id,
      role,
    });
  } catch (error) {
    if (createdInviteUser) {
      const cleanupResult = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      if (cleanupResult.error) {
        console.error("[admin-users]", {
          event: "invite_membership_failure_cleanup_failed",
          message: cleanupResult.error.message,
          status: cleanupResult.error.status,
        });
      }
    }

    throw error;
  }

  await sendTenantAdminInviteEmail({
    email,
    actionLink,
    role,
  });

  return {
    membershipId,
    email,
    pending: isPendingInvite(authUser),
  };
}

export async function resendBusinessAdminInvitation(input: {
  membershipId: unknown;
}) {
  const session = await requireAdminBusinessOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const usersById = await listAuthUsersById();
  const { data: membership, error: membershipError } = await withAdminUserRequestTimeout(
    supabaseAdmin
      .from("business_admin_memberships")
      .select("id, business_id, auth_user_id, role, status")
      .eq("id", membershipId)
      .eq("business_id", session.business.id)
      .eq("status", "active")
      .maybeSingle(),
    "Loading the pending invite",
  );

  if (membershipError) {
    mapDatabaseMutationError(membershipError);
  }

  if (!membership) {
    throw new BusinessAdminUserMutationError("membership_not_found", "Business user not found.");
  }

  const typedMembership = membership as Pick<BusinessAdminMembershipRow, "auth_user_id" | "role">;
  const authUser = usersById.get(typedMembership.auth_user_id);
  const email = authUser?.email?.trim().toLowerCase() ?? null;

  if (!email) {
    throw new BusinessAdminUserMutationError("auth_user_not_found", "Could not find that user's email.");
  }

  if (!isPendingInvite(authUser)) {
    throw new BusinessAdminUserMutationError(
      "not_pending",
      "Only pending invitations can be resent.",
    );
  }

  const generated = await generateAdminInviteLink(email, session.business);

  await sendTenantAdminInviteEmail({
    email,
    actionLink: generated.actionLink,
    role: typedMembership.role,
  });

  return { membershipId, email };
}

export async function updateBusinessAdminUserRole(input: {
  membershipId: unknown;
  role: unknown;
}) {
  const session = await requireAdminBusinessOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const role = normalizeBusinessAdminRole(input.role);
  const { error } = await withAdminUserRequestTimeout(
    supabaseAdmin.rpc("business_admin_update_membership", {
      p_actor_auth_user_id: session.user.id,
      p_business_id: session.business.id,
      p_membership_id: membershipId,
      p_role: role,
      p_status: null,
    }),
    "Updating admin access",
  );

  if (error) {
    mapDatabaseMutationError(error);
  }

  return { membershipId };
}

export async function disableBusinessAdminUser(input: {
  membershipId: unknown;
  confirmationEmail: unknown;
}) {
  const session = await requireAdminBusinessOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const confirmationEmail = normalizeConfirmationEmail(input.confirmationEmail);
  const { data: membership, error: membershipError } = await withAdminUserRequestTimeout(
    supabaseAdmin
      .from("business_admin_memberships")
      .select("id, business_id, auth_user_id")
      .eq("id", membershipId)
      .eq("business_id", session.business.id)
      .maybeSingle(),
    "Loading admin access",
  );

  if (membershipError) {
    mapDatabaseMutationError(membershipError);
  }

  if (!membership) {
    throw new BusinessAdminUserMutationError("membership_not_found", "Business user not found.");
  }

  const usersById = await listAuthUsersById();
  const authUser = usersById.get((membership as { auth_user_id: string }).auth_user_id);
  const targetEmail = authUser?.email?.toLowerCase() ?? null;

  if (!targetEmail || confirmationEmail !== targetEmail) {
    throw new BusinessAdminUserMutationError(
      "invalid_input",
      "Type the user's email address to confirm removing access.",
    );
  }

  const { error } = await withAdminUserRequestTimeout(
    supabaseAdmin.rpc("business_admin_update_membership", {
      p_actor_auth_user_id: session.user.id,
      p_business_id: session.business.id,
      p_membership_id: membershipId,
      p_role: null,
      p_status: "disabled",
    }),
    "Removing admin access",
  );

  if (error) {
    mapDatabaseMutationError(error);
  }

  return { membershipId };
}
