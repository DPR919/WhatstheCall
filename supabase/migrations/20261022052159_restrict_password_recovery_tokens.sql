-- GoTrue uses the same storage for magic-link and recovery tokens. Record only
-- reset tokens issued by this app, storing an irreversible digest, never a link.
create table app_private.password_recovery_intents (
  token_digest text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index password_recovery_intents_expiry on app_private.password_recovery_intents(expires_at);
alter table app_private.password_recovery_intents enable row level security;
revoke all on app_private.password_recovery_intents from public, anon, authenticated;

create function public.record_password_recovery_intent(p_email text, p_requested_after timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_digest text;
begin
  insert into app_private.password_recovery_intents(token_digest,user_id,expires_at)
    select encode(sha256(convert_to(u.recovery_token,'UTF8')),'hex'), u.id,
      u.recovery_sent_at + interval '1 hour'
    from auth.users u join public.profiles p on p.id=u.id
    where lower(u.email)=lower(btrim(p_email)) and p.status='active'
      and length(u.recovery_token) >= 20
      and u.recovery_sent_at >= p_requested_after - interval '5 seconds'
      and p_requested_after >= clock_timestamp() - interval '2 minutes'
      and p_requested_after <= clock_timestamp() + interval '5 seconds'
    on conflict (token_digest) do nothing returning token_digest into v_digest;
  delete from app_private.password_recovery_intents where ctid in (
    select ctid from app_private.password_recovery_intents where expires_at < clock_timestamp() limit 100
  );
  return v_digest is not null;
end $$;

create function public.claim_password_recovery_intent(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if p_token_hash is null or length(p_token_hash) not between 20 and 512
    or p_token_hash !~ '^[A-Za-z0-9_-]+$' then return null; end if;
  update app_private.password_recovery_intents i set used_at=clock_timestamp()
    where i.token_digest=encode(sha256(convert_to(p_token_hash,'UTF8')),'hex')
      and i.used_at is null and i.expires_at > clock_timestamp()
      and exists (select 1 from public.profiles p where p.id=i.user_id and p.status='active')
    returning user_id into v_user_id;
  return v_user_id;
end $$;
revoke all on function public.record_password_recovery_intent(text,timestamptz) from public, anon, authenticated;
revoke all on function public.claim_password_recovery_intent(text) from public, anon, authenticated;
grant execute on function public.record_password_recovery_intent(text,timestamptz) to service_role;
grant execute on function public.claim_password_recovery_intent(text) to service_role;
