do $$
declare
  item record;
  has_rls boolean;
begin
  for item in
    select * from (values
      ('profiles', true),
      ('clips', true),
      ('clip_responses', true),
      ('invite_codes', false),
      ('invite_redemptions', false)
    ) as expected(table_name, authenticated_can_select)
  loop
    select c.relrowsecurity into has_rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = item.table_name;

    if has_rls is distinct from true then
      raise exception 'RLS is disabled on public.%', item.table_name;
    end if;

    if has_table_privilege('anon', format('public.%I', item.table_name),
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'anon has access to public.%', item.table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', item.table_name),
      'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'authenticated can write public.%', item.table_name;
    end if;

    if has_table_privilege('authenticated', format('public.%I', item.table_name),
      'SELECT') is distinct from item.authenticated_can_select then
      raise exception 'Unexpected read grant on public.%', item.table_name;
    end if;
  end loop;
end $$;
