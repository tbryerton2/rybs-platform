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
  requireAdminBusinessContext,
  isAdminBusinessOwner,
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

import { businessUserStatus, normalizeBusinessUserName, type BusinessAdminUser, type BusinessUserEvent } from "./user-management-types";
export type { BusinessAdminUser } from "./user-management-types";

type BusinessAdminMembershipRow = {
  id: string;
  business_id: string;
  auth_user_id: string;
  role: AdminMembershipRole;
  status: "active" | "disabled";
  created_at: string;
  updated_at: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  last_invite_sent_at: string | null;
  last_invite_failed_at: string | null;
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

  const parts = [metadata?.first_name, metadata?.last_name].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ");
  return parts || fullName || name || null;
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
  if (error.code === "42703" && /first_name|last_name|full_name|accepted_at|invited_at|last_invite/.test(message)) {
    throw new BusinessAdminUserMutationError("membership_rpc_missing", "The user-management database update has not been applied yet.");
  }
  const friendlyErrors: Record<string, string> = {
    BUSINESS_ADMIN_INVALID_NAME: "Enter first and last names, each between 1 and 120 characters.",
    BUSINESS_ADMIN_ACCESS_REQUIRED: "Your business access has changed. Sign in again.",
    BUSINESS_ADMIN_ALREADY_EXISTS: "This user already belongs to this business. Open their details instead.",
    BUSINESS_ADMIN_NOT_PENDING: "This invitation is no longer pending. Refresh the user details.",
  };
  for (const [code, friendly] of Object.entries(friendlyErrors)) {
    if (message.includes(code)) throw new BusinessAdminUserMutationError("invalid_input", friendly);
  }

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

async function manageUser(input: {
  actorAuthUserId: string;
  businessId: string;
  action: string;
  membershipId?: string;
  targetAuthUserId?: string;
  firstName?: string;
  lastName?: string;
  role?: AdminMembershipRole;
}) {
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.rpc("business_admin_manage_user_v2", {
      p_actor_auth_user_id: input.actorAuthUserId,
      p_business_id: input.businessId,
      p_action: input.action,
      p_membership_id: input.membershipId ?? null,
      p_target_auth_user_id: input.targetAuthUserId ?? null,
      p_first_name: input.firstName ?? null,
      p_last_name: input.lastName ?? null,
      p_role: input.role ?? null,
    }), "Updating business user",
  );
  if (error) mapDatabaseMutationError(error);
  return String(data);
}

async function generateAdminInviteLink(email: string, tenant: TenantRecord, names?: { firstName: string; lastName: string }) {
  const redirectTo = await getAdminInviteRedirectTo(tenant);
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        ...(names ? { data: { first_name: names.firstName, last_name: names.lastName } } : {}),
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
  name: string;
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
    recipientName: input.name,
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

const MEMBERSHIP_FIELDS = "id, business_id, auth_user_id, role, status, created_at, updated_at, full_name, first_name, last_name, invited_at, accepted_at, last_invite_sent_at, last_invite_failed_at";

async function getMembership(membershipId: string, businessId: string) {
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.from("business_admin_memberships").select(MEMBERSHIP_FIELDS)
      .eq("id", membershipId).eq("business_id", businessId).maybeSingle(),
    "Loading business user",
  );
  if (error) mapDatabaseMutationError(error);
  if (!data) throw new BusinessAdminUserMutationError("membership_not_found", "Business user not found.");
  return data as BusinessAdminMembershipRow;
}

export async function getBusinessAdminUsers() {
  const session = await requireAdminBusinessContext();
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.from("business_admin_memberships").select(MEMBERSHIP_FIELDS)
      .eq("business_id", session.business.id).order("created_at", { ascending: true }),
    "Loading business users",
  );
  if (error) mapDatabaseMutationError(error);
  const users: BusinessAdminUser[] = await Promise.all(((data ?? []) as BusinessAdminMembershipRow[]).map(async (row) => {
    const { data: auth, error: authError } = await withAdminUserRequestTimeout(
      supabaseAdmin.auth.admin.getUserById(row.auth_user_id), "Loading user profile",
    );
    if (authError) throw new BusinessAdminUserMutationError("database_error", "Could not load a user profile. Try again.");
    return {
      membershipId: row.id, authUserId: row.auth_user_id,
      firstName: row.first_name, lastName: row.last_name,
      name: row.first_name ? [row.first_name, row.last_name].filter(Boolean).join(" ") : row.full_name ?? getUserName(auth.user), email: auth.user?.email ?? null,
      role: row.role, status: businessUserStatus(row.status, row.accepted_at),
      createdAt: row.created_at, updatedAt: row.updated_at, invitedAt: row.invited_at,
      acceptedAt: row.accepted_at, lastInviteSentAt: row.last_invite_sent_at,
      inviteDeliveryFailed: Boolean(row.last_invite_failed_at && (!row.last_invite_sent_at || row.last_invite_failed_at > row.last_invite_sent_at)),
      isCurrentUser: row.auth_user_id === session.user.id,
    };
  }));
  return {
    users, canManageAccess: isAdminBusinessOwner(session),
    activeOwnerCount: users.filter((user) => user.role === "owner" && user.status === "active").length,
  };
}

export async function getBusinessAdminUserActivity(membershipId: string, page = 0) {
  const session = await requireAdminBusinessContext();
  await getMembership(membershipId, session.business.id);
  const offset = Math.max(0, Math.min(page, 10000)) * 25;
  const { data, error } = await withAdminUserRequestTimeout(
    supabaseAdmin.from("business_admin_user_events")
      .select("id, actor_auth_user_id, actor_name, action, before_value, after_value, created_at")
      .eq("business_id", session.business.id).eq("membership_id", membershipId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 25),
    "Loading user activity",
  );
  if (error) mapDatabaseMutationError(error);
  return { events: (data ?? []).slice(0, 25) as BusinessUserEvent[], hasMore: (data ?? []).length > 25 };
}

function inputName(value: unknown, label: string) {
  try { return normalizeBusinessUserName(value, label); }
  catch (error) { throw new BusinessAdminUserMutationError("invalid_input", (error as Error).message); }
}

async function sendAndRecordInvitation(input: {
  membershipId: string; email: string; name: string; role: AdminMembershipRole; actionLink: string; resend: boolean;
}) {
  const session = await requireAdminBusinessOwner();
  const audit = { actorAuthUserId: session.user.id, businessId: session.business.id, membershipId: input.membershipId };
  try {
    await sendTenantAdminInviteEmail(input);
  } catch (error) {
    console.error("[admin-users]", { event: "invitation_delivery_failed", membershipId: input.membershipId, message: error instanceof Error ? error.message : String(error) });
    await manageUser({ ...audit, action: "failed" });
    throw new BusinessAdminUserMutationError("database_error", "The invitation was saved, but the email could not be sent. Open Invited users to resend it.");
  }
  await manageUser({ ...audit, action: input.resend ? "resent" : "sent" });
}

export async function inviteBusinessAdminUser(input: { firstName: unknown; lastName: unknown; email: unknown; role: unknown }) {
  const session = await requireAdminBusinessOwner();
  const firstName = inputName(input.firstName, "First name");
  const lastName = inputName(input.lastName, "Last name");
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  const role = normalizeBusinessAdminRole(input.role);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BusinessAdminUserMutationError("invalid_input", "Enter a valid email address.");

  let authUser = await findAuthUserByExactEmail(email);
  if (authUser) {
    const { data, error } = await supabaseAdmin.from("business_admin_memberships").select("id")
      .eq("business_id", session.business.id).eq("auth_user_id", authUser.id).maybeSingle();
    if (error) mapDatabaseMutationError(error);
    if (data) throw new BusinessAdminUserMutationError("invalid_input", "This user already belongs to this business. Open their details to resend an invitation or reactivate access.");
  }
  const generated = authUser && !isPendingInvite(authUser)
    ? await generateExistingUserAdminLink(email, session.business)
    : await generateAdminInviteLink(email, session.business, authUser ? undefined : { firstName, lastName });
  authUser = generated.authUser;
  // A retry can reuse this Auth identity if the membership transaction fails.
  const membershipId = await manageUser({ actorAuthUserId: session.user.id, businessId: session.business.id,
    action: "invite", targetAuthUserId: authUser.id, firstName, lastName, role });
  await sendAndRecordInvitation({ membershipId, email, name: firstName, role, actionLink: generated.actionLink, resend: false });
  return { membershipId, email };
}

export async function resendBusinessAdminInvitation(input: { membershipId: unknown }) {
  const session = await requireAdminBusinessOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const member = await getMembership(membershipId, session.business.id);
  if (member.status !== "active" || member.accepted_at) throw new BusinessAdminUserMutationError("not_pending", "Only pending invitations can be resent.");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(member.auth_user_id);
  if (error || !data.user?.email) throw new BusinessAdminUserMutationError("auth_user_not_found", "Could not find that user's email.");
  const generated = isPendingInvite(data.user)
    ? await generateAdminInviteLink(data.user.email, session.business)
    : await generateExistingUserAdminLink(data.user.email, session.business);
  await sendAndRecordInvitation({ membershipId, email: data.user.email, name: member.first_name || member.full_name || getUserName(data.user) || "there",
    role: member.role, actionLink: generated.actionLink, resend: true });
  return { membershipId, email: data.user.email };
}

export async function updateBusinessAdminUserName(input: { membershipId: unknown; firstName: unknown; lastName: unknown }) {
  const session = await requireAdminBusinessContext();
  return manageUser({ actorAuthUserId: session.user.id, businessId: session.business.id, action: "name",
    membershipId: normalizeMembershipId(input.membershipId), firstName: inputName(input.firstName, "First name"), lastName: inputName(input.lastName, "Last name") });
}

export async function updateBusinessAdminUserRole(input: { membershipId: unknown; role: unknown }) {
  const session = await requireAdminBusinessOwner();
  return manageUser({ actorAuthUserId: session.user.id, businessId: session.business.id, action: "role",
    membershipId: normalizeMembershipId(input.membershipId), role: normalizeBusinessAdminRole(input.role) });
}

export async function disableBusinessAdminUser(input: { membershipId: unknown; confirmationEmail: unknown }) {
  const session = await requireAdminBusinessOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const member = await getMembership(membershipId, session.business.id);
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(member.auth_user_id);
  if (error || !data.user?.email || normalizeConfirmationEmail(input.confirmationEmail) !== data.user.email.toLowerCase()) {
    throw new BusinessAdminUserMutationError("invalid_input", "Type the user's email address to confirm deactivation.");
  }
  return manageUser({ actorAuthUserId: session.user.id, businessId: session.business.id, action: "deactivate", membershipId });
}

export async function reactivateBusinessAdminUser(input: { membershipId: unknown }) {
  const session = await requireAdminBusinessOwner();
  return manageUser({ actorAuthUserId: session.user.id, businessId: session.business.id, action: "reactivate",
    membershipId: normalizeMembershipId(input.membershipId) });
}

export async function acceptBusinessAdminInvitation(userId: string, businessId: string, firstName: unknown, lastName: unknown) {
  return manageUser({ actorAuthUserId: userId, businessId, action: "accept", firstName: inputName(firstName, "First name"), lastName: inputName(lastName, "Last name") });
}
