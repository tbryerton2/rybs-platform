"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { UserPlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { businessUserEventLabel, type BusinessAdminUser, type BusinessUserEvent, type UserActionState } from "@/lib/admin/user-management-types";
import {
  inviteBusinessAdminUserAction, updateBusinessAdminUserNameAction, updateBusinessAdminUserRoleAction,
  disableBusinessAdminUserAction, reactivateBusinessAdminUserAction, resendBusinessAdminInvitationAction,
} from "./actions";

const inputClass = "mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "block text-sm font-semibold text-slate-700";
type FormAction = (state: UserActionState, data: FormData) => Promise<UserActionState>;

function MutationForm({ action, children, submitLabel, membershipId, disabled = false, danger = false }: {
  action: FormAction; children?: ReactNode; submitLabel: string; membershipId?: string; disabled?: boolean; danger?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      {membershipId ? <input type="hidden" name="membershipId" value={membershipId} /> : null}
      <fieldset disabled={pending || disabled} className="min-w-0 space-y-4 disabled:opacity-60">{children}</fieldset>
      {state.error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p> : null}
      {state.message ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{state.message}</p> : null}
      <button type="submit" disabled={pending || disabled} className={`admin-btn ${danger ? "admin-btn-secondary text-rose-700" : "admin-btn-primary"} disabled:cursor-not-allowed disabled:opacity-50`}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Dialog({ title, children, onClose, drawer = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return (
    <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}
      className={drawer
        ? "fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-2xl overflow-y-auto border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
        : "fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-sky-500"><XMarkIcon className="h-5 w-5" /></button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}

export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="admin-btn admin-btn-primary"><UserPlusIcon className="h-5 w-5" />Invite user</button>
    {open ? <Dialog title="Invite user" onClose={() => setOpen(false)}>
      <p className="mb-6 text-sm leading-6 text-slate-600">Invite someone to this business. They’ll receive an email to confirm their name and set up access.</p>
      <MutationForm action={inviteBusinessAdminUserAction} submitLabel="Send invitation">
        <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>First name<input name="firstName" autoComplete="given-name" required maxLength={120} className={inputClass} /></label><label className={labelClass}>Last name<input name="lastName" autoComplete="family-name" required maxLength={120} className={inputClass} /></label></div>
        <label className={labelClass}>Email<input name="email" type="email" autoComplete="email" required className={inputClass} /></label>
        <label className={labelClass}>Role<select name="role" defaultValue="admin" className={inputClass}><option value="admin">Admin</option><option value="owner">Owner</option></select></label>
        <p className="text-xs leading-5 text-slate-500">Owners can invite users and manage roles and access. Owners and Admins can edit names.</p>
      </MutationForm>
      <Link href="/admin/settings/users?filter=invited" onClick={() => setOpen(false)} className="mt-5 inline-block text-sm font-semibold text-sky-700 hover:underline">View invited users</Link>
    </Dialog> : null}
  </>;
}

export function UserStatusBadge({ status }: { status: BusinessAdminUser["status"] }) {
  const styles = status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : status === "invited" ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${styles}`}>{status}</span>;
}

export function UserDetailsPanel({ user, canManageAccess, activeOwnerCount, events, hasMore, activityPage, initialTab, returnHref, detailHref }: {
  user: BusinessAdminUser; canManageAccess: boolean; activeOwnerCount: number; events: BusinessUserEvent[]; hasMore: boolean;
  activityPage: number; initialTab: string; returnHref: string; detailHref: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const protectedOwner = user.role === "owner" && user.status === "active" && activeOwnerCount <= 1;
  const cannotChangeAccess = user.isCurrentUser || protectedOwner;
  const reason = user.isCurrentUser ? "You cannot change your own role or deactivate your own access." : "At least one active Owner must remain.";
  return <Dialog title="User details" drawer onClose={() => router.push(returnHref, { scroll: false })}>
    <div className="mb-6 min-w-0">
      <h3 className="break-words text-2xl font-semibold">{user.name || "Name not provided"}</h3>
      <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
      <div className="mt-3 flex items-center gap-2"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold capitalize text-sky-700">{user.role}</span><UserStatusBadge status={user.status} />{user.isCurrentUser ? <span className="text-xs text-slate-500">You</span> : null}</div>
    </div>
    <div className="mb-6 flex gap-1 border-b border-slate-200" aria-label="User detail sections">
      {[['profile', 'Profile'], ['access', 'Business access'], ['activity', 'Activity']].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === value ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}
    </div>
    {tab === "profile" ? <MutationForm action={updateBusinessAdminUserNameAction} membershipId={user.membershipId} submitLabel="Save name">
      <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>First name<input name="firstName" autoComplete="given-name" defaultValue={user.firstName ?? ""} required maxLength={120} className={inputClass} /></label><label className={labelClass}>Last name<input name="lastName" autoComplete="family-name" defaultValue={user.lastName ?? ""} required maxLength={120} className={inputClass} /></label></div>
      {!user.firstName && user.name ? <p className="text-sm text-slate-500">Previously saved name: {user.name}. Enter the first and last names above to update it.</p> : null}
      <p className="text-xs leading-5 text-slate-500">This name is used in this business. Other businesses and the shared login account are unchanged.</p>
      <div><div className={labelClass}>Email</div><p className="mt-2 break-all rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">{user.email ?? "Not available"}</p><p className="mt-2 text-xs text-slate-500">Login email is read-only.</p></div>
    </MutationForm> : null}
    {tab === "access" ? <div className="space-y-8">
      {!canManageAccess ? <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">Only Owners can change roles, manage invitations, or deactivate and reactivate business access.</p> : <>
        {cannotChangeAccess ? <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{reason}</p> : null}
        <MutationForm action={updateBusinessAdminUserRoleAction} membershipId={user.membershipId} submitLabel="Save role" disabled={cannotChangeAccess}>
          <label className={labelClass}>Role<select name="role" defaultValue={user.role} className={inputClass}><option value="admin">Admin</option><option value="owner">Owner</option></select></label>
        </MutationForm>
        {user.status === "invited" ? <section className="space-y-3 border-t border-slate-200 pt-6"><h4 className="font-semibold">Invitation</h4><p className="text-sm text-slate-600">Waiting for this person to accept their invitation.</p>{user.inviteDeliveryFailed ? <p role="alert" className="text-sm text-rose-700">The last invitation email could not be sent. Try resending it.</p> : null}<MutationForm action={resendBusinessAdminInvitationAction} membershipId={user.membershipId} submitLabel="Resend invitation" /></section> : null}
        <section className="space-y-3 border-t border-slate-200 pt-6"><h4 className="font-semibold">{user.status === "inactive" ? "Reactivate business access" : "Deactivate business access"}</h4>
          <p className="text-sm leading-6 text-slate-600">{user.status === "inactive" ? (user.acceptedAt ? "Restore this person’s access with their saved role." : "Restore their pending invitation. They’ll still need to accept it; you can then resend the invitation email.") : "This person will lose access to this business. Their account, other businesses, and activity history are preserved."}</p>
          {user.status === "inactive" ? <MutationForm action={reactivateBusinessAdminUserAction} membershipId={user.membershipId} submitLabel="Reactivate access" /> : <MutationForm action={disableBusinessAdminUserAction} membershipId={user.membershipId} submitLabel="Deactivate access" disabled={cannotChangeAccess} danger>
            <label className={labelClass}>Confirm their email<input name="confirmationEmail" type="email" required placeholder={user.email ?? "Email"} autoComplete="off" className={inputClass} /></label>
          </MutationForm>}
        </section>
      </>}
    </div> : null}
    {tab === "activity" ? <div>
      <p className="mb-5 text-sm leading-6 text-slate-500">User-management history for this business. Earlier changes and activity elsewhere in the app may not be recorded.</p>
      {events.length === 0 ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">No user-management activity recorded yet.</p> : <ol className="divide-y divide-slate-200">{events.map(event => <li key={event.id} className="py-4 first:pt-0">
        <div className="font-semibold text-slate-900">{businessUserEventLabel(event.action)}</div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(event.created_at))} ET · {event.actor_name || (event.actor_auth_user_id === user.authUserId ? user.name || "This user" : "Business user")}</p>
        {event.before_value !== null || event.after_value !== null ? <p className="mt-2 break-words text-sm text-slate-600">{event.before_value ?? "Not set"} <span aria-label="changed to">→</span> {event.after_value ?? "Not set"}</p> : null}
      </li>)}</ol>}
      <div className="mt-5 flex justify-between gap-4">{activityPage > 0 ? <Link href={`${detailHref}&tab=activity&activityPage=${activityPage - 1}`} scroll={false} className="text-sm font-semibold text-sky-700">Newer activity</Link> : <span />}{hasMore ? <Link href={`${detailHref}&tab=activity&activityPage=${activityPage + 1}`} scroll={false} className="text-sm font-semibold text-sky-700">Older activity</Link> : null}</div>
    </div> : null}
  </Dialog>;
}
