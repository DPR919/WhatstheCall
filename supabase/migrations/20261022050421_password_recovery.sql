-- Coordination contains only keyed email hashes, never email addresses or tokens.
create table app_private.recovery_email_cooldowns (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  next_allowed_at timestamptz not null
);
alter table app_private.recovery_email_cooldowns enable row level security;
revoke all on app_private.recovery_email_cooldowns from public, anon, authenticated;

create function public.claim_password_recovery_email(p_email_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_claimed text;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('password-recovery:' || p_email_hash, 0));
  if exists (select 1 from app_private.recovery_email_cooldowns
    where key_hash = p_email_hash and next_allowed_at > clock_timestamp()) then return false; end if;
  if not public.consume_request_limit(p_email_hash, 3, 3600) then return false; end if;
  insert into app_private.recovery_email_cooldowns as cooldown (key_hash, next_allowed_at)
    values (p_email_hash, clock_timestamp() + interval '60 seconds')
    on conflict (key_hash) do update set next_allowed_at = excluded.next_allowed_at
    returning key_hash into v_claimed;
  delete from app_private.recovery_email_cooldowns where ctid in (
    select ctid from app_private.recovery_email_cooldowns
    where next_allowed_at < clock_timestamp() - interval '1 hour' limit 100
  );
  return v_claimed is not null;
end $$;

-- A signed recovery cookie is also bound to an existing, unexpired Auth session.
-- This immediately rejects replay after that session has been revoked.
create function public.password_recovery_session_is_active(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s join public.profiles p on p.id = s.user_id
    where s.id = p_session_id and s.user_id = p_user_id and p.status = 'active'
    and (s.not_after is null or s.not_after > now()));
$$;
revoke all on function public.claim_password_recovery_email(text) from public, anon, authenticated;
revoke all on function public.password_recovery_session_is_active(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_password_recovery_email(text) to service_role;
grant execute on function public.password_recovery_session_is_active(uuid,uuid) to service_role;
