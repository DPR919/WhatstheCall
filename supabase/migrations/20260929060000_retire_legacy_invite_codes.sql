-- Run when the invitation signup flow launches.
update public.invite_codes
set is_active = false
where created_by_user_id is null and is_active = true;
