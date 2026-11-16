begin;
insert into public.tenants(id,slug) values('11111111-1111-4111-8111-111111111201','position-test-a'),('11111111-1111-4111-8111-111111111202','position-test-b');
insert into public.dumpster_product_settings(id,business_id,dumpster_size,dumpster_product_id,display_name,is_public) values
 ('11111111-1111-4111-8111-111111111211','11111111-1111-4111-8111-111111111201','10 yard','ten','Ten',true),
 ('11111111-1111-4111-8111-111111111212','11111111-1111-4111-8111-111111111201','20-yard','twenty','Hidden twenty',false),
 ('11111111-1111-4111-8111-111111111213','11111111-1111-4111-8111-111111111202','10 yard','ten','Other tenant',true);
set local role service_role;
do $$
declare a uuid='11111111-1111-4111-8111-111111111201';
 x uuid='11111111-1111-4111-8111-111111111211'; y uuid='11111111-1111-4111-8111-111111111212';
 foreign_id uuid='11111111-1111-4111-8111-111111111213'; saved uuid[]; bad uuid[];
begin
 assert (select position=2 from public.dumpster_product_settings where id=y),'Inserts append';
 perform public.initialize_dumpster_product_positions(a,array[y,x],'{"preserved":true}');
 assert (select position=1 and not is_public from public.dumpster_product_settings where id=y),'Hidden product stays hidden';
 assert (select position=1 from public.dumpster_product_settings where id=foreign_id),'Tenant isolation';
 perform public.reorder_dumpster_products(a,array[x,y]);
 perform public.initialize_dumpster_product_positions(a,array[y,x],'{}');
 assert (select position=1 from public.dumpster_product_settings where id=x),'Repeat migration preserves later reorder';
 foreach bad slice 1 in array array[array[x,x],array[x,foreign_id],array[x,null::uuid]] loop
  begin
   perform public.reorder_dumpster_products(a,bad);
   raise exception 'Invalid order was accepted';
  exception when raise_exception then
   if sqlerrm='Invalid order was accepted' then raise; end if;
  end;
 end loop;
 begin
  perform public.reorder_dumpster_products(a,array[x]);
  raise exception 'Partial list was accepted';
 exception when raise_exception then
  if sqlerrm='Partial list was accepted' then raise; end if;
 end;
 select array_agg(id order by position) into saved from public.dumpster_product_settings where business_id=a;
 assert saved=array[x,y],'Failed requests roll back completely';
 perform public.ensure_dumpster_product_positions(a,'[{"dumpster_size":"20 yard","dumpster_product_id":"twenty-alias","display_name":"Do not expose hidden alias"}]');
 assert (select count(*)=2 from public.dumpster_product_settings where business_id=a),'Size aliases must not expose hidden products';
 perform public.ensure_dumpster_product_positions(a,'[{"dumpster_size":"30 yard","dumpster_product_id":"thirty","display_name":"Thirty"}]');
 assert (select position=3 and is_public from public.dumpster_product_settings where business_id=a and dumpster_product_id='thirty'),'Already-public offered size appends';
 begin
  perform public.reorder_dumpster_products(a,array[x,y]);
  raise exception 'Stale list was accepted';
 exception when raise_exception then
  if sqlerrm='Stale list was accepted' then raise; end if;
 end;
 assert (select count(*)=3 and count(distinct position)=3 and min(position)=1 and max(position)=3 from public.dumpster_product_settings where business_id=a),'Contiguous positions retained';
 begin
  perform public.initialize_dumpster_product_positions('11111111-1111-4111-8111-111111111202',array[foreign_id],'{}',
   '[{"dumpster_size":"50 yard","dumpster_product_id":"fifty","display_name":"Fifty"}]');
  raise exception 'Incomplete initialization accepted';
 exception when raise_exception then
  if sqlerrm='Incomplete initialization accepted' then raise; end if;
 end;
 assert (select count(*)=1 from public.dumpster_product_settings where business_id='11111111-1111-4111-8111-111111111202'),'Failed initialization rolls back new rows too';
 assert not has_function_privilege('anon','public.reorder_dumpster_products(uuid,uuid[])','EXECUTE');
 assert not has_function_privilege('authenticated','public.ensure_dumpster_product_positions(uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','public.initialize_dumpster_product_positions(uuid,uuid[],jsonb,jsonb)','EXECUTE');
 assert not has_table_privilege('anon','public.dumpster_product_order_migrations','SELECT');
end $$;
rollback;
