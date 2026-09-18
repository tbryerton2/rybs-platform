import {
  ExclamationTriangleIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { isAdminBusinessOwner, requireAdminOwner } from "@/lib/admin/auth";
import { getBusinessAdminUsers, type BusinessAdminUser } from "@/lib/admin/users";
import {
  disableBusinessAdminUserAction,
  inviteBusinessAdminUserAction,
  resendBusinessAdminInvitationAction,
  updateBusinessAdminUserRoleAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function roleLabel(role: BusinessAdminUser["role"]) {
  return role === "owner" ? "Owner" : "Admin";
}

function statusLabel(status: BusinessAdminUser["status"]) {
  return status === "pending" ? "Pending" : "Active";
}

function roleBadgeClassName(role: BusinessAdminUser["role"]) {
  return role === "owner"
    ? "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusBadgeClassName(status: BusinessAdminUser["status"]) {
  return status === "active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
}

function Message({ params }: { params: SearchParams }) {
  const error = readParam(params, "error");
  const status = readParam(params, "status");
  const email = readParam(params, "email");

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </div>
    );
  }

  if (status === "invited") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Invite sent{email ? ` to ${email}` : ""}.
      </div>
    );
  }

  if (status === "granted") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Admin access granted{email ? ` to ${email}` : ""}.
      </div>
    );
  }

  if (status === "resent") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Invite resent{email ? ` to ${email}` : ""}.
      </div>
    );
  }

  if (status === "role-updated") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        User role updated.
      </div>
    );
  }

  if (status === "removed") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        User access removed.
      </div>
    );
  }

  return null;
}

function OwnerRequiredPage() {
  return (
    <AdminPage width="standard" className="pt-2">
      <AdminPageHeader
        eyebrow="Settings"
        title="Users"
        description="Only active Owners can manage business admin users."
      />

      <section className="rounded-[14px] border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Owner access required</h2>
            <p className="mt-1 text-sm leading-6">
              Admins can use the business admin tools, but only Owners can invite, remove, or change user roles.
            </p>
          </div>
        </div>
      </section>
    </AdminPage>
  );
}

function AddUserForm() {
  return (
    <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200">
          <UserPlusIcon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Invite User</h2>
        </div>
      </div>

      <form action={inviteBusinessAdminUserAction} className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_10rem_auto]">
        <div>
          <label htmlFor="email" className="text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="text-sm font-semibold text-slate-700">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="admin"
            className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          >
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
        </div>

        <div className="flex items-end">
          <FormSubmitButton loadingLabel="Sending..." className="admin-btn admin-btn-primary h-11 px-5">
            Invite User
          </FormSubmitButton>
        </div>
      </form>
    </section>
  );
}

function UserBadges({ user }: { user: BusinessAdminUser }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={joinClasses(
          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
          roleBadgeClassName(user.role),
        )}
      >
        {roleLabel(user.role)}
      </span>
      <span
        className={joinClasses(
          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
          statusBadgeClassName(user.status),
        )}
      >
        {statusLabel(user.status)}
      </span>
    </div>
  );
}

function RoleForm({
  user,
  activeOwnerCount,
}: {
  user: BusinessAdminUser;
  activeOwnerCount: number;
}) {
  const isLastActiveOwner =
    user.role === "owner" && user.status === "active" && activeOwnerCount <= 1;
  const disabled = user.isCurrentUser || isLastActiveOwner;

  return (
    <form action={updateBusinessAdminUserRoleAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="membershipId" value={user.membershipId} />
      <select
        name="role"
        defaultValue={user.role}
        disabled={disabled}
        className="h-9 rounded-[8px] border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
        aria-label={`Role for ${user.email ?? user.authUserId}`}
      >
        <option value="admin">Admin</option>
        <option value="owner">Owner</option>
      </select>
      <FormSubmitButton
        loadingLabel="Saving..."
        disabled={disabled}
        className="admin-btn admin-btn-secondary admin-btn-sm"
      >
        Save
      </FormSubmitButton>
    </form>
  );
}

function ResendInviteForm({ user }: { user: BusinessAdminUser }) {
  if (user.status !== "pending") return null;

  return (
    <form action={resendBusinessAdminInvitationAction}>
      <input type="hidden" name="membershipId" value={user.membershipId} />
      <FormSubmitButton loadingLabel="Sending..." className="admin-btn admin-btn-secondary admin-btn-sm">
        Resend Invite
      </FormSubmitButton>
    </form>
  );
}

function RemoveForm({
  user,
  activeOwnerCount,
}: {
  user: BusinessAdminUser;
  activeOwnerCount: number;
}) {
  const isLastActiveOwner =
    user.role === "owner" && user.status === "active" && activeOwnerCount <= 1;

  if (user.isCurrentUser) {
    return (
      <div className="text-xs leading-5 text-slate-500">
        You cannot remove your own access.
      </div>
    );
  }

  if (isLastActiveOwner) {
    return (
      <div className="text-xs leading-5 text-slate-500">
        This is the last active Owner.
      </div>
    );
  }

  return (
    <form action={disableBusinessAdminUserAction} className="flex flex-wrap justify-end gap-2">
      <input type="hidden" name="membershipId" value={user.membershipId} />
      <input
        name="confirmationEmail"
        type="email"
        placeholder={user.email ?? "Confirm email"}
        aria-label={`Type ${user.email ?? "the user email"} to remove access`}
        className="h-9 w-52 rounded-[8px] border border-slate-300 px-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        required
      />
      <FormSubmitButton loadingLabel="Removing..." className="admin-btn admin-btn-secondary admin-btn-sm">
        Remove
      </FormSubmitButton>
    </form>
  );
}

function UserRow({
  user,
  activeOwnerCount,
}: {
  user: BusinessAdminUser;
  activeOwnerCount: number;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-4 pl-4 pr-3 sm:pl-5">
        <div className="min-w-[12rem]">
          <div className="font-semibold text-slate-900">{user.name ?? "Not provided"}</div>
          {user.isCurrentUser ? <div className="mt-1 text-xs text-slate-500">Current user</div> : null}
        </div>
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{user.email ?? "Not available"}</td>
      <td className="px-3 py-4">
        <UserBadges user={user} />
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{formatDate(user.createdAt)}</td>
      <td className="py-4 pl-3 pr-4 text-right sm:pr-5">
        <div className="flex min-w-[18rem] flex-col items-end gap-2">
          <RoleForm user={user} activeOwnerCount={activeOwnerCount} />
          <div className="flex flex-wrap justify-end gap-2">
            <ResendInviteForm user={user} />
            <RemoveForm user={user} activeOwnerCount={activeOwnerCount} />
          </div>
        </div>
      </td>
    </tr>
  );
}

function UserCard({
  user,
  activeOwnerCount,
}: {
  user: BusinessAdminUser;
  activeOwnerCount: number;
}) {
  return (
    <article className="border-b border-slate-100 p-4 last:border-0">
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-semibold text-slate-900">{user.name ?? "Not provided"}</div>
          <div className="mt-1 break-all text-sm text-slate-600">{user.email ?? "Not available"}</div>
          {user.isCurrentUser ? <div className="mt-1 text-xs text-slate-500">Current user</div> : null}
        </div>
        <UserBadges user={user} />
        <div className="text-xs text-slate-500">Added {formatDate(user.createdAt)}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <RoleForm user={user} activeOwnerCount={activeOwnerCount} />
          <ResendInviteForm user={user} />
          <RemoveForm user={user} activeOwnerCount={activeOwnerCount} />
        </div>
      </div>
    </article>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requireAdminOwner();

  if (!isAdminBusinessOwner(session)) {
    return <OwnerRequiredPage />;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const { users, activeOwnerCount } = await getBusinessAdminUsers();

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <AdminPageHeader
        eyebrow="Settings"
        title="Users"
        description="Manage who can access this business admin."
      />

      <Message params={resolvedSearchParams} />
      <AddUserForm />

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
            <UsersIcon className="h-[18px] w-[18px]" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Users</h2>
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600 sm:px-5">
            No users found.
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pl-5">
                      Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Email
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Access
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Added
                    </th>
                    <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pr-5">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm">
                  {users.map((user) => (
                    <UserRow key={user.membershipId} user={user} activeOwnerCount={activeOwnerCount} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden">
              {users.map((user) => (
                <UserCard key={user.membershipId} user={user} activeOwnerCount={activeOwnerCount} />
              ))}
            </div>
          </>
        )}
      </section>
    </AdminPage>
  );
}
