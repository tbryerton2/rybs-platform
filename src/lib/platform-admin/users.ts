import "server-only";

import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import {
  requirePlatformOwner,
  type PlatformAdminMembershipStatus,
  type PlatformAdminRole,
} from "@/lib/platform-admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/identity";

type PlatformAdminMembershipRow = {
  id: string;
  auth_user_id: string;
  role: PlatformAdminRole;
  status: PlatformAdminMembershipStatus;
  created_at: string;
  updated_at: string;
};

export type PlatformAdminUser = {
  membershipId: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  role: PlatformAdminRole;
  status: PlatformAdminMembershipStatus;
  createdAt: string;
  updatedAt: string;
  isCurrentUser: boolean;
};

export type GrantPlatformAdminUserResult = {
  membershipId: string;
  email: string;
  invited: boolean;
};

export type PlatformAdminUserMutationErrorCode =
  | "invalid_input"
  | "owner_required"
  | "auth_user_not_found"
  | "membership_not_found"
  | "membership_rpc_missing"
  | "last_owner"
  | "self_update_blocked"
  | "database_error";

export class PlatformAdminUserMutationError extends Error {
  code: PlatformAdminUserMutationErrorCode;

  constructor(code: PlatformAdminUserMutationErrorCode, message: string) {
    super(message);
    this.name = "PlatformAdminUserMutationError";
    this.code = code;
  }
}

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function normalizePlatformAdminRole(value: unknown): PlatformAdminRole {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (role === "owner" || role === "admin") {
    return role;
  }

  throw new PlatformAdminUserMutationError("invalid_input", "Choose Owner or Admin.");
}

function normalizeMembershipId(value: unknown) {
  const membershipId = typeof value === "string" ? value.trim() : "";

  if (!membershipId) {
    throw new PlatformAdminUserMutationError("invalid_input", "Choose a platform user.");
  }

  return membershipId;
}

function normalizeConfirmationEmail(value: unknown) {
  return normalizeEmail(typeof value === "string" ? value : "");
}

function getUserName(user: User | undefined) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  const name = typeof metadata?.name === "string" ? metadata.name.trim() : "";

  return fullName || name || null;
}

async function listAuthUsersById() {
  const usersById = new Map<string, User>();
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new PlatformAdminUserMutationError(
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
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new PlatformAdminUserMutationError(
        "database_error",
        `Could not list Supabase Auth users: ${error.message}`,
      );
    }

    const user = (data.users ?? []).find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) {
      return user;
    }

    if ((data.users ?? []).length < perPage) {
      break;
    }
  }

  return null;
}

function normalizeProtocol(value: string | null) {
  if (value === "http" || value === "https") {
    return value;
  }

  return null;
}

async function getPlatformAdminInviteRedirectTo() {
  const headerStore = await headers();
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    normalizeProtocol(headerStore.get("x-forwarded-proto")) ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const origin = host ? `${protocol}://${host}` : configuredSiteUrl;

  if (!origin) {
    throw new PlatformAdminUserMutationError(
      "database_error",
      "Could not determine the Platform Admin invite redirect URL.",
    );
  }

  return `${origin}/platform-admin/auth/callback`;
}

function mapDatabaseMutationError(error: SupabaseDbError): never {
  const message = error.message ?? "";

  if (
    error.code === "PGRST202" &&
    message.includes("platform_admin_") &&
    message.includes("schema cache")
  ) {
    throw new PlatformAdminUserMutationError(
      "membership_rpc_missing",
      "Platform Admin user-management database functions are not installed. Apply the pending Supabase migration and try again.",
    );
  }

  if (message.includes("PLATFORM_ADMIN_OWNER_REQUIRED")) {
    throw new PlatformAdminUserMutationError(
      "owner_required",
      "Only active platform owners can manage Platform Users.",
    );
  }

  if (message.includes("PLATFORM_ADMIN_MEMBERSHIP_NOT_FOUND")) {
    throw new PlatformAdminUserMutationError("membership_not_found", "Platform user not found.");
  }

  if (message.includes("PLATFORM_ADMIN_LAST_OWNER")) {
    throw new PlatformAdminUserMutationError(
      "last_owner",
      "At least one active Platform Owner is required.",
    );
  }

  if (message.includes("PLATFORM_ADMIN_SELF_UPDATE_BLOCKED")) {
    throw new PlatformAdminUserMutationError(
      "self_update_blocked",
      "You cannot change or revoke your own Platform Admin access.",
    );
  }

  if (message.includes("PLATFORM_ADMIN_INVALID_ROLE")) {
    throw new PlatformAdminUserMutationError("invalid_input", "Choose Owner or Admin.");
  }

  if (message.includes("PLATFORM_ADMIN_INVALID_STATUS")) {
    throw new PlatformAdminUserMutationError("invalid_input", "Choose a valid status.");
  }

  console.error("[platform-admin-users]", {
    event: "mutation_database_error",
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  throw new PlatformAdminUserMutationError(
    "database_error",
    "We could not update Platform Users. Try again in a moment.",
  );
}

export async function getPlatformAdminUsers() {
  const session = await requirePlatformOwner();
  const [membershipResult, usersById] = await Promise.all([
    supabaseAdmin
      .from("platform_admin_memberships")
      .select("id, auth_user_id, role, status, created_at, updated_at")
      .order("created_at", { ascending: true }),
    listAuthUsersById(),
  ]);

  if (membershipResult.error) {
    throw new Error(membershipResult.error.message);
  }

  const users = ((membershipResult.data ?? []) as PlatformAdminMembershipRow[]).map((row) => {
    const authUser = usersById.get(row.auth_user_id);

    return {
      membershipId: row.id,
      authUserId: row.auth_user_id,
      name: getUserName(authUser),
      email: authUser?.email ?? null,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isCurrentUser: row.auth_user_id === session.user.id,
    };
  });

  return {
    users,
    activeOwnerCount: users.filter((user) => user.role === "owner" && user.status === "active").length,
    currentUserId: session.user.id,
  };
}

async function grantMembership(input: {
  actorAuthUserId: string;
  targetAuthUserId: string;
  role: PlatformAdminRole;
}) {
  const { data, error } = await supabaseAdmin.rpc("platform_admin_grant_membership", {
    p_actor_auth_user_id: input.actorAuthUserId,
    p_target_auth_user_id: input.targetAuthUserId,
    p_role: input.role,
  });

  if (error) {
    mapDatabaseMutationError(error);
  }

  return String(data);
}

async function invitePlatformAdminUser(email: string): Promise<User> {
  const redirectTo = await getPlatformAdminInviteRedirectTo();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (error || !data.user) {
    throw new PlatformAdminUserMutationError(
      "database_error",
      error?.message ?? "Supabase Auth did not return an invited user.",
    );
  }

  return data.user;
}

export async function grantPlatformAdminUser(input: {
  email: unknown;
  role: unknown;
}): Promise<GrantPlatformAdminUserResult> {
  const session = await requirePlatformOwner();
  const email = normalizeEmail(typeof input.email === "string" ? input.email : "");
  const role = normalizePlatformAdminRole(input.role);

  if (!email) {
    throw new PlatformAdminUserMutationError("invalid_input", "Enter a valid email address.");
  }

  let invited = false;
  let authUser = await findAuthUserByExactEmail(email);

  if (!authUser) {
    try {
      authUser = await invitePlatformAdminUser(email);
      invited = true;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const looksLikeExistingUser = message.includes("already") || message.includes("registered");

      if (!looksLikeExistingUser) {
        throw error;
      }

      authUser = await findAuthUserByExactEmail(email);
      if (!authUser) {
        throw new PlatformAdminUserMutationError(
          "auth_user_not_found",
          "The user already exists in Auth, but could not be found for membership creation.",
        );
      }
    }
  }

  let membershipId: string;

  try {
    membershipId = await grantMembership({
      actorAuthUserId: session.user.id,
      targetAuthUserId: authUser.id,
      role,
    });
  } catch (error) {
    if (invited) {
      const cleanupResult = await supabaseAdmin.auth.admin.deleteUser(authUser.id);

      if (cleanupResult.error) {
        console.error("[platform-admin-users]", {
          event: "invite_membership_failure_cleanup_failed",
          message: cleanupResult.error.message,
          status: cleanupResult.error.status,
        });
      }
    }

    throw error;
  }

  return {
    membershipId,
    email,
    invited,
  };
}

export async function updatePlatformAdminUserRole(input: {
  membershipId: unknown;
  role: unknown;
}) {
  const session = await requirePlatformOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const role = normalizePlatformAdminRole(input.role);
  const { error } = await supabaseAdmin.rpc("platform_admin_update_membership", {
    p_actor_auth_user_id: session.user.id,
    p_membership_id: membershipId,
    p_role: role,
    p_status: null,
  });

  if (error) {
    mapDatabaseMutationError(error);
  }

  return { membershipId };
}

export async function disablePlatformAdminUser(input: {
  membershipId: unknown;
  confirmationEmail: unknown;
}) {
  const session = await requirePlatformOwner();
  const membershipId = normalizeMembershipId(input.membershipId);
  const confirmationEmail = normalizeConfirmationEmail(input.confirmationEmail);
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("platform_admin_memberships")
    .select("id, auth_user_id")
    .eq("id", membershipId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    throw new PlatformAdminUserMutationError("membership_not_found", "Platform user not found.");
  }

  const usersById = await listAuthUsersById();
  const authUser = usersById.get((membership as { auth_user_id: string }).auth_user_id);
  const targetEmail = authUser?.email?.toLowerCase() ?? null;

  if (!targetEmail || confirmationEmail !== targetEmail) {
    throw new PlatformAdminUserMutationError(
      "invalid_input",
      "Type the user's email address to confirm revoking access.",
    );
  }

  const { error } = await supabaseAdmin.rpc("platform_admin_update_membership", {
    p_actor_auth_user_id: session.user.id,
    p_membership_id: membershipId,
    p_role: null,
    p_status: "disabled",
  });

  if (error) {
    mapDatabaseMutationError(error);
  }

  return { membershipId };
}
