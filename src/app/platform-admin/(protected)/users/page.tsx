import {
  ExclamationTriangleIcon,
  UserPlusIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { isPlatformAdminOwner, requirePlatformAdmin } from "@/lib/platform-admin/auth";
import { getPlatformAdminUsers, type PlatformAdminUser } from "@/lib/platform-admin/users";
import {
  disablePlatformAdminUserAction,
  grantPlatformAdminUserAction,
  updatePlatformAdminUserRoleAction,
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

function roleLabel(role: PlatformAdminUser["role"]) {
  return role === "owner" ? "Owner" : "Admin";
}

function statusLabel(status: PlatformAdminUser["status"]) {
  return status === "active" ? "Active" : "Disabled";
}

function roleBadgeClassName(role: PlatformAdminUser["role"]) {
  return role === "owner"
    ? "bg-sky-50 text-sky-700 ring-sky-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
}

function statusBadgeClassName(status: PlatformAdminUser["status"]) {
  return status === "active"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-slate-200";
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
        Invite sent and Platform Admin access granted{email ? ` to ${email}` : ""}.
      </div>
    );
  }

  if (status === "granted") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Platform Admin access granted{email ? ` to ${email}` : ""}.
      </div>
    );
  }

  if (status === "role-updated") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Platform User role updated.
      </div>
    );
  }

  if (status === "disabled") {
    return (
      <div className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        Platform Admin access revoked.
      </div>
    );
  }

  return null;
}

function OwnerRequiredPage() {
  return (
    <AdminPage width="standard" className="pt-2">
      <AdminPageHeader
        eyebrow="Platform"
        title="Platform Users"
        description="Manage who can access Platform Admin."
      />

      <section className="rounded-[14px] border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <div className="flex gap-3">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">Owner access required</h2>
            <p className="mt-1 text-sm leading-6">
              Active Platform Admins can manage businesses, but only active Platform Owners can
              manage Platform Users.
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
          <h2 className="text-sm font-semibold text-slate-900">Add User</h2>
        </div>
      </div>

      <form action={grantPlatformAdminUserAction} className="mt-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_10rem_auto]">
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
          <FormSubmitButton loadingLabel="Adding..." className="admin-btn admin-btn-primary h-11 px-5">
            Add User
          </FormSubmitButton>
        </div>
      </form>
    </section>
  );
}

function RoleForm({
  user,
  activeOwnerCount,
}: {
  user: PlatformAdminUser;
  activeOwnerCount: number;
}) {
  const isLastActiveOwner =
    user.role === "owner" && user.status === "active" && activeOwnerCount <= 1;
  const disabled = user.status !== "active" || user.isCurrentUser || isLastActiveOwner;

  return (
    <form action={updatePlatformAdminUserRoleAction} className="flex flex-wrap items-center gap-2">
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

function RevokeForm({
  user,
  activeOwnerCount,
}: {
  user: PlatformAdminUser;
  activeOwnerCount: number;
}) {
  const isLastActiveOwner =
    user.role === "owner" && user.status === "active" && activeOwnerCount <= 1;

  if (user.status !== "active") {
    return (
      <div className="text-xs leading-5 text-slate-500">
        Access is revoked. Add this email again to reactivate access.
      </div>
    );
  }

  if (user.isCurrentUser) {
    return (
      <div className="text-xs leading-5 text-slate-500">
        You cannot revoke your own Platform Admin access.
      </div>
    );
  }

  if (isLastActiveOwner) {
    return (
      <div className="text-xs leading-5 text-slate-500">
        This is the last active Platform Owner.
      </div>
    );
  }

  return (
    <form action={disablePlatformAdminUserAction} className="mt-2 flex flex-wrap justify-end gap-2">
      <input type="hidden" name="membershipId" value={user.membershipId} />
      <input
        name="confirmationEmail"
        type="email"
        placeholder={user.email ?? "Confirm email"}
        aria-label={`Type ${user.email ?? "the user email"} to revoke access`}
        className="h-9 w-52 rounded-[8px] border border-slate-300 px-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        required
      />
      <FormSubmitButton loadingLabel="Revoking..." className="admin-btn admin-btn-secondary admin-btn-sm">
        Revoke
      </FormSubmitButton>
    </form>
  );
}

function UserRow({
  user,
  activeOwnerCount,
}: {
  user: PlatformAdminUser;
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
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            roleBadgeClassName(user.role),
          )}
        >
          {roleLabel(user.role)}
        </span>
      </td>
      <td className="px-3 py-4">
        <span
          className={joinClasses(
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
            statusBadgeClassName(user.status),
          )}
        >
          {statusLabel(user.status)}
        </span>
      </td>
      <td className="px-3 py-4 text-sm text-slate-600">{formatDate(user.createdAt)}</td>
      <td className="py-4 pl-3 pr-4 text-right sm:pr-5">
        <div className="flex min-w-[18rem] flex-col items-end gap-2">
          <RoleForm user={user} activeOwnerCount={activeOwnerCount} />
          <RevokeForm user={user} activeOwnerCount={activeOwnerCount} />
        </div>
      </td>
    </tr>
  );
}

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await requirePlatformAdmin();

  if (!isPlatformAdminOwner(session)) {
    return <OwnerRequiredPage />;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const { users, activeOwnerCount } = await getPlatformAdminUsers();

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <AdminPageHeader
        eyebrow="Platform"
        title="Platform Users"
        description="Manage who can access Platform Admin."
      />

      <Message params={resolvedSearchParams} />
      <AddUserForm />

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
            <UsersIcon className="h-[18px] w-[18px]" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Platform Users</h2>
        </div>

        {users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-600 sm:px-5">
            No Platform Users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    Role
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date added
                  </th>
                  <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500 sm:pr-5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((user) => (
                  <UserRow key={user.membershipId} user={user} activeOwnerCount={activeOwnerCount} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
