import Link from "next/link";
import { UsersIcon } from "@heroicons/react/24/outline";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getBusinessAdminUsers, getBusinessAdminUserActivity, BusinessAdminUserMutationError } from "@/lib/admin/users";
import type { BusinessUserFilter } from "@/lib/admin/user-management-types";
import { InviteUserButton, UserDetailsPanel, UserStatusBadge } from "./user-controls";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const filters: BusinessUserFilter[] = ["active", "invited", "inactive", "all"];
function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]; return Array.isArray(value) ? value[0] : value;
}
export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const filterInput = param(params, "filter") as BusinessUserFilter;
  const filter = filters.includes(filterInput) ? filterInput : "active";
  let userData: Awaited<ReturnType<typeof getBusinessAdminUsers>>;
  try {
    userData = await getBusinessAdminUsers();
  } catch (error) {
    if (!(error instanceof BusinessAdminUserMutationError) || error.code !== "membership_rpc_missing") throw error;
    return <AdminPage width="wide"><AdminPageHeader eyebrow="Settings" title="Users" description="Manage the people who can access this business." /><div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">The new user-management features are ready for the database update. Existing business access is unchanged.</div></AdminPage>;
  }
  const { users, activeOwnerCount, canManageAccess } = userData;
  const visibleUsers = users.filter(user => filter === "all" || user.status === filter);
  const selectedUser = users.find(user => user.membershipId === param(params, "user"));
  const requestedPage = Number(param(params, "activityPage") ?? 0);
  const activityPage = Number.isSafeInteger(requestedPage) ? Math.max(0, Math.min(requestedPage, 10000)) : 0;
  const activity = selectedUser ? await getBusinessAdminUserActivity(selectedUser.membershipId, activityPage) : { events: [], hasMore: false };
  const events = activity.events.map(event => {
    const actor = users.find(user => user.authUserId === event.actor_auth_user_id);
    return { ...event, actor_name: event.actor_name || actor?.name || actor?.email || `Former user (${event.actor_auth_user_id.slice(0, 8)})` };
  });
  const returnHref = `/admin/settings/users?filter=${filter}`;
  const userHref = (id: string) => `${returnHref}&user=${id}`;
  return <AdminPage width="wide" className="space-y-6 pt-2">
    <AdminPageHeader eyebrow="Settings" title="Users" description="Manage the people who can access this business." actions={canManageAccess ? <InviteUserButton /> : undefined} />
    <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-500"><UsersIcon className="h-5 w-5" /></span><h2 className="font-semibold text-slate-900">Business users</h2></div>
        <nav aria-label="Filter users by status" className="flex flex-wrap gap-1">{filters.map(value => <Link key={value} href={`/admin/settings/users?filter=${value}`} aria-current={filter === value ? "page" : undefined} className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize ${filter === value ? "bg-orange-50 text-orange-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>{value} <span className="ml-1 text-xs">{value === "all" ? users.length : users.filter(user => user.status === value).length}</span></Link>)}</nav>
      </div>
      {visibleUsers.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">No {filter === "all" ? "" : `${filter} `}users to show.</div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Name", "Email", "Role", "Status", "Added", ""].map((label, index) => <th key={index} scope="col" className="px-5 py-3 font-semibold">{label || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{visibleUsers.map(user => <tr key={user.membershipId} className="hover:bg-slate-50/60">
            <td className="max-w-xs px-5 py-5"><Link href={userHref(user.membershipId)} scroll={false} className="break-words font-semibold text-slate-900 hover:text-orange-600">{user.name || "Add name"}</Link>{user.isCurrentUser ? <p className="mt-1 text-xs text-slate-500">Current user</p> : null}</td>
            <td className="max-w-xs break-all px-5 py-5 text-slate-600">{user.email ?? "Not available"}</td>
            <td className="px-5 py-5 capitalize text-slate-600">{user.role}</td>
            <td className="px-5 py-5"><UserStatusBadge status={user.status} />{user.status === "invited" && user.inviteDeliveryFailed ? <p className="mt-1 text-xs text-rose-600">Email not sent</p> : null}</td>
            <td className="whitespace-nowrap px-5 py-5 text-slate-500">{new Intl.DateTimeFormat("en-US", {dateStyle:"medium", timeZone:"America/New_York"}).format(new Date(user.createdAt))}</td>
            <td className="px-5 py-5 text-right"><Link href={userHref(user.membershipId)} scroll={false} aria-label={`Manage ${user.name || user.email || "user"}`} className="admin-btn admin-btn-secondary admin-btn-sm">Manage</Link></td>
          </tr>)}</tbody>
        </table></div>
        <div className="divide-y divide-slate-100 lg:hidden">{visibleUsers.map(user => <article key={user.membershipId} className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={userHref(user.membershipId)} scroll={false} className="break-words font-semibold text-slate-900">{user.name || "Add name"}</Link><p className="mt-1 break-all text-sm text-slate-500">{user.email}</p></div><Link href={userHref(user.membershipId)} scroll={false} className="text-sm font-semibold text-orange-600">Manage</Link></div><div className="mt-3 flex items-center gap-3"><span className="text-sm capitalize text-slate-600">{user.role}</span><UserStatusBadge status={user.status} />{user.isCurrentUser ? <span className="text-xs text-slate-500">You</span> : null}</div>{user.status === "invited" && user.inviteDeliveryFailed ? <p className="mt-2 text-xs text-rose-600">Invitation email not sent</p> : null}</article>)}</div>
      </>}
    </section>
    {selectedUser ? <UserDetailsPanel key={selectedUser.membershipId} user={selectedUser} canManageAccess={canManageAccess} activeOwnerCount={activeOwnerCount} events={events} hasMore={activity.hasMore} activityPage={activityPage} initialTab={param(params, "tab") === "activity" ? "activity" : "profile"} returnHref={returnHref} detailHref={userHref(selectedUser.membershipId)} /> : null}
  </AdminPage>;
}
