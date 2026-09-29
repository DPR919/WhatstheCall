-- Install the transactional invite functions before enabling the new signup flow.
-- Legacy creatorless codes are retired separately at launch.
create or replace function public.create_member_invite(p_user_id uuid, p_code text)
returns public.invite_codes
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_invite public.invite_codes%rowtype;
begin
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found or v_profile.status <> 'active' then
    raise exception 'Active profile required' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    raise exception 'Verified email required' using errcode = 'P0001';
  end if;
  if v_profile.referral_generated_count >= least(v_profile.referral_limit, 5) then
    raise exception 'Lifetime invite allowance reached' using errcode = 'P0001';
  end if;

  insert into public.invite_codes (code, created_by_user_id, max_uses, use_count, is_active)
  values (p_code, p_user_id, 1, 0, true)
  returning * into v_invite;
  update public.profiles
  set referral_generated_count = referral_generated_count + 1
  where id = p_user_id;
  return v_invite;
end;
$$;

create or replace function public.claim_member_invite(p_code text)
returns public.invite_codes
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invite_codes%rowtype;
begin
  select * into v_invite
  from public.invite_codes
  where code = p_code
  for update;

  if not found or not v_invite.is_active or v_invite.created_by_user_id is null
    or v_invite.max_uses <> 1 or v_invite.use_count <> 0
    or (v_invite.expires_at is not null and v_invite.expires_at <= now())
    or not exists (
      select 1 from public.profiles
      where id = v_invite.created_by_user_id and status = 'active'
    ) then
    raise exception 'Invite code is invalid or already used' using errcode = 'P0001';
  end if;

  update public.invite_codes set use_count = 1 where id = v_invite.id;
  v_invite.use_count := 1;
  return v_invite;
end;
$$;

create or replace function public.complete_member_invite(
  p_invite_id uuid, p_user_id uuid, p_email text, p_display_name text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invite_codes%rowtype;
begin
  select * into v_invite from public.invite_codes where id = p_invite_id for update;
  if not found or v_invite.use_count <> 1 or v_invite.created_by_user_id is null
    or exists (select 1 from public.invite_redemptions where invite_code_id = p_invite_id)
    or not exists (
      select 1 from auth.users
      where id = p_user_id and lower(email) = lower(p_email)
    ) then
    raise exception 'Cannot complete invite' using errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(lower(p_display_name)));
  if exists (select 1 from public.profiles where lower(display_name) = lower(p_display_name)) then
    raise exception 'Display name is already taken' using errcode = 'P0001';
  end if;

  insert into public.profiles (
    id, email, display_name, invited_by_user_id, invite_code_used_id,
    referral_limit, referral_generated_count, status
  ) values (
    p_user_id, lower(p_email), p_display_name, v_invite.created_by_user_id,
    v_invite.id, 5, 0, 'active'
  );
  insert into public.invite_redemptions (invite_code_id, redeemed_by_user_id)
  values (p_invite_id, p_user_id);
  update public.profiles
  set referral_redeemed_count = referral_redeemed_count + 1
  where id = v_invite.created_by_user_id;
end;
$$;

create or replace function public.release_member_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.invite_codes where id = p_invite_id for update;
  update public.invite_codes set use_count = 0
  where id = p_invite_id and use_count = 1
    and not exists (
      select 1 from public.invite_redemptions where invite_code_id = p_invite_id
    );
end;
$$;

revoke all on function public.create_member_invite(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_member_invite(text) from public, anon, authenticated;
revoke all on function public.complete_member_invite(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_member_invite(uuid) from public, anon, authenticated;
grant execute on function public.create_member_invite(uuid, text) to service_role;
grant execute on function public.claim_member_invite(text) to service_role;
grant execute on function public.complete_member_invite(uuid, uuid, text, text) to service_role;
grant execute on function public.release_member_invite(uuid) to service_role;
