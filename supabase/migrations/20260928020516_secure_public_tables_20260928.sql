-- Direct Data API clients only read their own rows; server routes use service_role.
alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;
alter table public.clips enable row level security;
alter table public.clip_responses enable row level security;

revoke all privileges on table
  public.profiles,
  public.invite_codes,
  public.invite_redemptions,
  public.clips,
  public.clip_responses
from anon, authenticated;

grant select on table
  public.profiles,
  public.clips,
  public.clip_responses
to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Uploaders can read their own clips"
  on public.clips for select to authenticated
  using (uploaded_by_user_id = (select auth.uid()));

create policy "Users can read their own responses"
  on public.clip_responses for select to authenticated
  using (user_id = (select auth.uid()));

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
