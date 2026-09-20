-- Finestate access control.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- 1. One row per person, created automatically when they sign up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'member',   -- 'admin' or 'member'
  status      text not null default 'pending',  -- 'pending', 'active' or 'blocked'
  -- Page ids this person may open. New members get the family pages by default;
  -- the Admin section is granted by hand on the Logins page.
  access      text[] not null default array['assets','income','investing/opportunities','investing/ratios-calcs'],
  created_at  timestamptz not null default now()
);

-- 2. Fill it in on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. "Am I an admin?" as a security-definer function, so the policies below
--    can ask it without reading profiles recursively.
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- 4. Row level security: you see yourself, admins see and manage everyone.
alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists "update own name" on public.profiles;
create policy "update own name" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admins manage everyone" on public.profiles;
create policy "admins manage everyone" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 5. After you have signed up once, make yourself the admin by running this
--    with your own email address:
-- update public.profiles
--    set role = 'admin', status = 'active', access = array['admin/planning','admin/site-running-costs','admin/logins','assets','income','investing/opportunities','investing/ratios-calcs']
--  where email = 'you@example.com';

-- 6. Admin-only documents (Legal documents page). The content is private data,
--    so it lives here rather than in the site's code.
create table if not exists public.admin_docs (
  id         text primary key,
  data       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_docs enable row level security;

drop policy if exists "admins only" on public.admin_docs;
create policy "admins only" on public.admin_docs
  for all using (public.is_admin()) with check (public.is_admin());
