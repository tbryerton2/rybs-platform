-- Run against local Supabase only. Every fixture and mutation is rolled back.
begin;
insert into public.tenants (id, slug, status) values
 ('29000000-0000-4000-8000-000000000001', 'user-lifecycle-test-a', 'active'),
 ('29000000-0000-4000-8000-000000000002', 'user-lifecycle-test-b', 'active');
insert into auth.users (id, email, raw_user_meta_data) values
 ('29000000-0000-4000-8000-000000000011', 'owner@lifecycle.test', '{}'),
 ('29000000-0000-4000-8000-000000000012', 'admin@lifecycle.test', '{}'),
 ('29000000-0000-4000-8000-000000000013', 'invite@lifecycle.test', '{}');
insert into public.business_admin_memberships (id, business_id, auth_user_id, role, full_name) values
 ('29000000-0000-4000-8000-000000000021', '29000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000011', 'owner', 'Owner'),
 ('29000000-0000-4000-8000-000000000022', '29000000-0000-4000-8000-000000000001', '29000000-0000-4000-8000-000000000012', 'admin', 'Admin'),
 ('29000000-0000-4000-8000-000000000023', '29000000-0000-4000-8000-000000000002', '29000000-0000-4000-8000-000000000012', 'owner', 'Other business name');
set local role service_role;
do $$
declare
 b uuid := '29000000-0000-4000-8000-000000000001';
 other_b uuid := '29000000-0000-4000-8000-000000000002';
 owner_id uuid := '29000000-0000-4000-8000-000000000011';
 admin_id uuid := '29000000-0000-4000-8000-000000000012';
 invited_id uuid := '29000000-0000-4000-8000-000000000013';
 owner_member uuid := '29000000-0000-4000-8000-000000000021';
 admin_member uuid := '29000000-0000-4000-8000-000000000022';
 other_member uuid := '29000000-0000-4000-8000-000000000023';
 invited_member uuid;
 events_before integer;
begin
 perform public.business_admin_manage_user_v2(admin_id,b,'name',owner_member,null,'Corrected','Owner');
 assert (select first_name = 'Corrected' and last_name = 'Owner' and full_name = 'Corrected Owner' from public.business_admin_memberships where id=owner_member), 'Admin may edit owner name';
 perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,'Corrected','Admin');
 assert (select full_name = 'Other business name' from public.business_admin_memberships where id=other_member), 'Names must be business scoped';
 assert (select count(*)=2 from public.business_admin_user_events where business_id=b), 'Name changes must be audited';
 select count(*) into events_before from public.business_admin_user_events where business_id=b;
 perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,'Corrected','Admin');
 assert (select count(*)=events_before from public.business_admin_user_events where business_id=b), 'No-op edits do not add history';
 begin perform public.business_admin_manage_user_v2(admin_id,b,'role',owner_member,null,null,null,'admin'); raise exception 'TEST: Admin changed role'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_OWNER_REQUIRED%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(admin_id,b,'deactivate',owner_member); raise exception 'TEST: Admin deactivated owner'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_OWNER_REQUIRED%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(owner_id,b,'name',other_member,null,'Wrong','tenant'); raise exception 'TEST: Cross-tenant edit'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(owner_id,b,'deactivate',owner_member); raise exception 'TEST: Self-deactivation'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_SELF_UPDATE_BLOCKED%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,' '); raise exception 'TEST: Blank name'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_INVALID_NAME%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(owner_id,b,'role',admin_member,null,null,null,'superuser'); raise exception 'TEST: Invalid role'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_INVALID_ROLE%' then raise; end if; end;
 invited_member := public.business_admin_manage_user_v2(owner_id,b,'invite',null,invited_id,'Invited','Person','owner');
 assert (select accepted_at is null and invited_at is not null from public.business_admin_memberships where id=invited_member), 'Existing Auth users must also accept invitations';
 begin perform public.business_admin_manage_user_v2(invited_id,b,'role',owner_member,null,null,null,'admin'); raise exception 'TEST: Invited owner changed role'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_ACCESS_REQUIRED%' then raise; end if; end;
 begin perform public.business_admin_manage_user_v2(owner_id,b,'invite',null,invited_id,'Duplicate','Person','admin'); raise exception 'TEST: Duplicate invite'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_ALREADY_EXISTS%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'failed',invited_member);
 assert (select last_invite_failed_at is not null from public.business_admin_memberships where id=invited_member), 'Delivery failures are recorded';
 perform public.business_admin_manage_user_v2(owner_id,b,'resent',invited_member);
 perform public.business_admin_manage_user_v2(owner_id,b,'deactivate',invited_member);
 begin perform public.business_admin_manage_user_v2(invited_id,b,'accept',null,null,'Invited','Person'); raise exception 'TEST: Disabled invite accepted'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'reactivate',invited_member);
 assert (select accepted_at is null from public.business_admin_memberships where id=invited_member), 'Reactivation does not bypass acceptance';
 begin perform public.business_admin_manage_user_v2(invited_id,other_b,'accept',null,null,'Invited','Person'); raise exception 'TEST: Wrong business accepted'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(invited_id,b,'accept',null,null,'Confirmed','Person');
 assert (select accepted_at is not null and first_name='Confirmed' and last_name='Person' from public.business_admin_memberships where id=invited_member), 'Acceptance activates access and confirms name';
 assert (select count(*)=1 from public.business_admin_user_events where membership_id=invited_member and action='invite_accepted'), 'Acceptance audited once';
 perform public.business_admin_manage_user_v2(invited_id,b,'accept',null,null,'Confirmed','Person');
 assert (select count(*)=1 from public.business_admin_user_events where membership_id=invited_member and action='invite_accepted'), 'Acceptance retry is idempotent';
 begin perform public.business_admin_manage_user_v2(owner_id,b,'resent',invited_member); raise exception 'TEST: Resent accepted invitation'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_NOT_PENDING%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'role',invited_member,null,null,null,'admin');
 perform public.business_admin_manage_user_v2(owner_id,b,'deactivate',admin_member);
 begin perform public.business_admin_manage_user_v2(admin_id,b,'name',owner_member,null,'Disabled','actor'); raise exception 'TEST: Disabled session retained access'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_ACCESS_REQUIRED%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'reactivate',admin_member);
 assert (select status='active' and role='admin' from public.business_admin_memberships where id=admin_member), 'Reactivation preserves role';
 begin update public.business_admin_user_events set after_value='tampered' where business_id=b; raise exception 'TEST: Mutable audit'; exception when insufficient_privilege then null; end;
 begin delete from public.business_admin_user_events where business_id=b; raise exception 'TEST: Deletable audit'; exception when insufficient_privilege then null; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,'Mary Jane','van der Berg');
 assert (select first_name='Mary Jane' and last_name='van der Berg' from public.business_admin_memberships where id=admin_member);
 select count(*) into events_before from public.business_admin_user_events where business_id=b;
 perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,'Mary','Jane van der Berg');
 assert (select count(*)=events_before+1 from public.business_admin_user_events where business_id=b), 'Changed name boundaries are audited';
 begin perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,'Jane',' '); raise exception 'TEST: Blank surname'; exception when others then if sqlerrm not like '%BUSINESS_ADMIN_INVALID_NAME%' then raise; end if; end;
 perform public.business_admin_manage_user_v2(owner_id,b,'name',admin_member,null,repeat('a',120),repeat('b',120));
 assert (select length(full_name)=241 from public.business_admin_memberships where id=admin_member);
 raise notice 'Business user lifecycle: permission, isolation, invitation, deactivation, and audit assertions passed';
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('authenticated','public.business_admin_manage_user_v2(uuid,uuid,text,uuid,uuid,text,text,text)','execute');
 assert not has_function_privilege('anon','public.business_admin_manage_user_v2(uuid,uuid,text,uuid,uuid,text,text,text)','execute');
 assert not has_table_privilege('authenticated','public.business_admin_user_events','select');
 assert (select relrowsecurity from pg_class where oid='public.business_admin_user_events'::regclass);
end $$;
rollback;
