-- Private coordination data is never exposed through the Data API.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.signup_registrations (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null unique references public.invite_codes(id),
  email text not null unique,
  display_name text not null,
  state text not null default 'sending' check (state in ('sending', 'delivery_failed', 'complete')),
  user_id uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table app_private.display_name_claims (
  normalized_name text primary key,
  profile_id uuid,
  registration_id uuid references app_private.signup_registrations(id),
  check (num_nonnulls(profile_id, registration_id) = 1)
);
-- Grandfather existing collisions without renaming anybody. This registry
-- prevents every new collision, including with any existing profile.
insert into app_private.display_name_claims(normalized_name, profile_id)
select lower(btrim(display_name)), min(id::text)::uuid from public.profiles group by 1;

create table app_private.request_limits (
  key_hash text not null,
  bucket bigint not null,
  window_seconds integer not null,
  attempts integer not null,
  expires_at timestamptz not null,
  primary key (key_hash, bucket, window_seconds)
);
create index request_limits_expiry on app_private.request_limits(expires_at);
alter table app_private.signup_registrations enable row level security;
alter table app_private.display_name_claims enable row level security;
alter table app_private.request_limits enable row level security;
revoke all on all tables in schema app_private from public, anon, authenticated;

create function app_private.enforce_display_name() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text := lower(btrim(new.display_name));
begin
  if TG_OP = 'UPDATE' and lower(btrim(old.display_name)) = v_name then return new; end if;
  insert into app_private.display_name_claims(normalized_name, profile_id)
  values (v_name, new.id) on conflict do nothing;
  if not exists (select 1 from app_private.display_name_claims
    where normalized_name = v_name and profile_id = new.id) then
    raise exception 'Display name is unavailable' using errcode = '23505';
  end if;
  -- Keep old names reserved to prevent impersonation after a rename.
  return new;
end $$;
revoke all on function app_private.enforce_display_name() from public, anon, authenticated;
create trigger enforce_unique_display_name before insert or update of display_name
on public.profiles for each row execute function app_private.enforce_display_name();

create function public.consume_request_limit(p_key_hash text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_bucket bigint; v_attempts integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 10000
    or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  v_bucket := floor(extract(epoch from clock_timestamp()) / p_window_seconds);
  insert into app_private.request_limits as limits
    (key_hash, bucket, window_seconds, attempts, expires_at)
  values (p_key_hash, v_bucket, p_window_seconds, 1,
    to_timestamp((v_bucket + 2) * p_window_seconds))
  on conflict (key_hash, bucket, window_seconds) do update
    set attempts = limits.attempts + 1 where limits.attempts < p_limit
  returning attempts into v_attempts;
  -- Bound storage without retaining raw IPs or emails.
  delete from app_private.request_limits where ctid in (
    select ctid from app_private.request_limits where expires_at < clock_timestamp() limit 100
  );
  return v_attempts is not null;
end $$;

create function public.reserve_member_registration(p_code text, p_email text, p_display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_invite public.invite_codes%rowtype;
  v_registration app_private.signup_registrations%rowtype;
  v_email text := lower(btrim(p_email)); v_name text := btrim(p_display_name);
begin
  if length(v_email) > 254 or length(v_name) < 2 or length(v_name) > 50 then
    raise exception 'Invalid registration' using errcode = 'P0001';
  end if;
  select * into v_invite from public.invite_codes where code = upper(btrim(p_code)) for update;
  if not found or not v_invite.is_active or v_invite.created_by_user_id is null
    or v_invite.max_uses <> 1
    or (v_invite.expires_at is not null and v_invite.expires_at <= now())
    or not exists (select 1 from public.profiles where id = v_invite.created_by_user_id and status = 'active') then
    raise exception 'Registration is unavailable' using errcode = 'P0001';
  end if;
  select * into v_registration from app_private.signup_registrations where invite_id = v_invite.id;
  if found then
    if v_registration.email <> v_email or lower(v_registration.display_name) <> lower(v_name) then
      raise exception 'Registration is unavailable' using errcode = 'P0001';
    end if;
    return jsonb_build_object('id', v_registration.id, 'send_email', false, 'state', v_registration.state);
  end if;
  if v_invite.use_count <> 0 or exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'Registration is unavailable' using errcode = 'P0001';
  end if;
  insert into app_private.signup_registrations(invite_id, email, display_name)
  values (v_invite.id, v_email, v_name) returning * into v_registration;
  -- A unique key arbitrates simultaneous claims of differently capitalized names.
  insert into app_private.display_name_claims(normalized_name, registration_id)
  values (lower(v_name), v_registration.id);
  update public.invite_codes set use_count = 1 where id = v_invite.id;
  return jsonb_build_object('id', v_registration.id, 'send_email', true, 'state', 'sending');
exception when unique_violation then
  raise exception 'Registration is unavailable' using errcode = 'P0001';
end $$;

create function public.finish_member_registration(p_registration_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_registration app_private.signup_registrations%rowtype;
  v_invite public.invite_codes%rowtype; v_user_id uuid;
begin
  select * into v_registration from app_private.signup_registrations
  where id = p_registration_id for update;
  if not found then return false; end if;
  if v_registration.state = 'complete' then return true; end if;
  -- Reconcile even if the process died after Auth accepted the invitation.
  -- Email and timestamps are trusted Auth columns, not editable user metadata.
  select id into v_user_id from auth.users where lower(email) = v_registration.email
    and created_at >= v_registration.created_at
    and invited_at >= v_registration.created_at;
  if v_user_id is null then return false; end if;
  select * into v_invite from public.invite_codes where id = v_registration.invite_id for update;
  update app_private.display_name_claims set profile_id = v_user_id, registration_id = null
    where registration_id = v_registration.id;
  insert into public.profiles(id, email, display_name, invited_by_user_id, invite_code_used_id,
    referral_limit, referral_generated_count, status)
  values(v_user_id, v_registration.email, v_registration.display_name, v_invite.created_by_user_id,
    v_invite.id, 5, 0, 'active');
  insert into public.invite_redemptions(invite_code_id, redeemed_by_user_id) values(v_invite.id, v_user_id);
  update public.profiles set referral_redeemed_count = referral_redeemed_count + 1
    where id = v_invite.created_by_user_id;
  update app_private.signup_registrations set state = 'complete', user_id = v_user_id,
    updated_at = clock_timestamp() where id = v_registration.id;
  return true;
end $$;

create function public.finish_own_member_registration(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select r.id into v_id from app_private.signup_registrations r join auth.users u
    on lower(u.email) = r.email where u.id = p_user_id and u.email_confirmed_at is not null;
  if v_id is null then return false; end if;
  return public.finish_member_registration(v_id);
end $$;

create function public.mark_registration_delivery_failed(p_registration_id uuid)
returns void language sql security definer set search_path = '' as $$
  update app_private.signup_registrations set state = 'delivery_failed', updated_at = clock_timestamp()
  where id = p_registration_id and state = 'sending';
$$;

-- Compatibility with the previously deployed route: it must never free a
-- durable reservation while an invitation may already be on its way.
create or replace function public.release_member_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.invite_codes where id = p_invite_id for update;
  update public.invite_codes set use_count = 0 where id = p_invite_id and use_count = 1
    and not exists (select 1 from public.invite_redemptions where invite_code_id = p_invite_id)
    and not exists (select 1 from app_private.signup_registrations where invite_id = p_invite_id);
end $$;

revoke all on function public.consume_request_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_member_registration(text, text, text) from public, anon, authenticated;
revoke all on function public.finish_member_registration(uuid) from public, anon, authenticated;
revoke all on function public.finish_own_member_registration(uuid) from public, anon, authenticated;
revoke all on function public.mark_registration_delivery_failed(uuid) from public, anon, authenticated;
grant execute on function public.consume_request_limit(text, integer, integer) to service_role;
grant execute on function public.reserve_member_registration(text, text, text) to service_role;
grant execute on function public.finish_member_registration(uuid) to service_role;
grant execute on function public.finish_own_member_registration(uuid) to service_role;
grant execute on function public.mark_registration_delivery_failed(uuid) to service_role;
