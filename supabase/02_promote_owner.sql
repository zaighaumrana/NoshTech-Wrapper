-- STEP 1: In Supabase > Authentication > Users, create the owner's email/password user.
-- STEP 2: Replace OWNER_EMAIL_HERE below with the exact owner's email and run.
-- The owner role cannot be assigned from the public application.
do $$
begin
 if not exists(select 1 from auth.users where email='OWNER_EMAIL_HERE') then
  raise exception 'Create the owner in Authentication > Users first, then replace OWNER_EMAIL_HERE';
 end if;
 update public.profiles set role='owner',display_name='Restaurant Owner'
 where id=(select id from auth.users where email='OWNER_EMAIL_HERE');
end $$;
select p.display_name,p.role,u.email from public.profiles p join auth.users u on u.id=p.id order by p.created_at;
