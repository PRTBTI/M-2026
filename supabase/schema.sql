-- KIPI Mundial 2026 Typer - Supabase schema
-- Run this file in Supabase SQL Editor before enabling online mode.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  last_name text not null default '',
  nickname text not null default '',
  role text not null default 'client' check (role in ('client', 'admin')),
  verified boolean not null default false,
  favorite_team text not null default '',
  accent text not null default '#f1861d',
  compact boolean not null default false,
  theme text not null default 'dark' check (theme in ('light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.results (
  match_id integer primary key,
  home integer not null check (home >= 0),
  away integer not null check (away >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.predictions (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id integer not null,
  home integer not null check (home >= 0),
  away integer not null check (away >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.profiles enable row level security;
alter table public.results enable row level security;
alter table public.predictions enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists results_touch_updated_at on public.results;
create trigger results_touch_updated_at
before update on public.results
for each row execute function public.touch_updated_at();

drop trigger if exists predictions_touch_updated_at on public.predictions;
create trigger predictions_touch_updated_at
before update on public.predictions
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    nickname,
    role,
    verified
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'nickname', ''),
    case when exists (select 1 from public.profiles) then 'client' else 'admin' end,
    new.email_confirmed_at is not null
  )
  on conflict (id) do update set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    nickname = excluded.nickname,
    verified = excluded.verified;
  return new;
end;
$$;

create or replace function public.sync_user_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set verified = new.email_confirmed_at is not null
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_confirmation_changed on auth.users;
create trigger on_auth_user_confirmation_changed
after update of email_confirmed_at on auth.users
for each row execute function public.sync_user_confirmation();

drop policy if exists "Profiles are readable by signed users" on public.profiles;
create policy "Profiles are readable by signed users"
on public.profiles for select
to authenticated
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Results readable by signed users" on public.results;
create policy "Results readable by signed users"
on public.results for select
to authenticated
using (true);

drop policy if exists "Admins manage results" on public.results;
create policy "Admins manage results"
on public.results for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Predictions readable by signed users" on public.predictions;
create policy "Predictions readable by signed users"
on public.predictions for select
to authenticated
using (true);

drop policy if exists "Users manage own predictions" on public.predictions;
create policy "Users manage own predictions"
on public.predictions for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins manage all predictions" on public.predictions;
create policy "Admins manage all predictions"
on public.predictions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
