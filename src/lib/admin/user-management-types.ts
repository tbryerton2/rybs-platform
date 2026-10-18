export type BusinessUserStatus = "active" | "invited" | "inactive";
export type BusinessUserFilter = BusinessUserStatus | "all";
export type BusinessAdminUser = {
  membershipId: string;
  authUserId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: "owner" | "admin";
  status: BusinessUserStatus;
  createdAt: string;
  updatedAt: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  lastInviteSentAt: string | null;
  inviteDeliveryFailed: boolean;
  isCurrentUser: boolean;
};
export type BusinessUserEvent = {
  id: string;
  actor_auth_user_id: string;
  actor_name: string | null;
  action: string;
  before_value: string | null;
  after_value: string | null;
  created_at: string;
};
export type UserActionState = { error?: string; message?: string; membershipId?: string };

export function businessUserStatus(status: "active" | "disabled", acceptedAt: string | null): BusinessUserStatus {
  return status === "disabled" ? "inactive" : acceptedAt ? "active" : "invited";
}
export function normalizeBusinessUserName(value: unknown, label = "Name") {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 120) throw new Error(`${label} must be between 1 and 120 characters.`);
  return name;
}
export function businessUserEventLabel(action: string) {
  const labels: Record<string, string> = {
    invited: "User invited", invitation_sent: "Invitation email sent", invitation_resent: "Invitation email resent",
    invitation_failed: "Invitation email failed", invite_accepted: "Invitation accepted", name_updated: "Name updated",
    role_updated: "Role updated", deactivated: "Business access deactivated", reactivated: "Business access reactivated",
  };
  return labels[action] ?? "User updated";
}
