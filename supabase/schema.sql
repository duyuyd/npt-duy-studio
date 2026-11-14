-- Phase 1: run in the SQL editor of a dedicated Supabase project.
-- Public settings must never contain credentials or private information.
begin;

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]{0,79}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  constraint platform_settings_value_valid check (
    case key
      when 'primary_color' then
        jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^#[0-9a-fA-F]{6}$'
      when 'hero_title' then
        jsonb_typeof(value) = 'string' and char_length(btrim(value #>> '{}')) between 1 and 160
      when 'enable_ai_build' then jsonb_typeof(value) = 'boolean'
      else octet_length(value::text) <= 16384
    end
  )
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'user')),
  subscription_plan text not null default 'free'
    check (char_length(subscription_plan) between 1 and 40),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  type text not null check (type in ('web', 'app')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_id_idx on public.projects(owner_id);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null check (path ~ '^/' and char_length(path) between 1 and 240),
  ui_tree jsonb not null default '{"nodes":[]}'::jsonb
    check (jsonb_typeof(ui_tree) = 'object'),
  unique (project_id, path),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pages_project_id_idx on public.pages(project_id);

-- Client accounts can read key metadata for their own projects, never the hash.
-- Provision and revoke keys later via a trusted backend; never persist plaintext.
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists api_keys_project_id_idx on public.api_keys(project_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

drop trigger if exists platform_settings_updated_at on public.platform_settings;
create trigger platform_settings_updated_at before update on public.platform_settings
for each row execute function public.set_updated_at();
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();
drop trigger if exists pages_updated_at on public.pages;
create trigger pages_updated_at before update on public.pages
for each row execute function public.set_updated_at();

-- This trigger never reads user-controlled metadata to decide admin status.
create or replace function public.sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
revoke all on function public.sync_auth_profile() from public, anon, authenticated;
drop trigger if exists sync_auth_profile on auth.users;
create trigger sync_auth_profile after insert or update of email on auth.users
for each row execute function public.sync_auth_profile();

-- Existing Auth accounts get a profile; no existing role/tier is overwritten.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Table owner runs this narrowly scoped check; clients cannot change roles.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function public.is_platform_admin() from public, anon, authenticated;
grant execute on function public.is_platform_admin() to authenticated;

alter table public.platform_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.pages enable row level security;
alter table public.api_keys enable row level security;

revoke all on table public.platform_settings, public.profiles, public.projects,
  public.pages, public.api_keys from public, anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant update (value) on public.platform_settings to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.projects, public.pages to authenticated;
grant select (id, project_id, created_at, revoked_at) on public.api_keys to authenticated;

drop policy if exists settings_public_read on public.platform_settings;
create policy settings_public_read on public.platform_settings for select to anon, authenticated
using (true);
drop policy if exists settings_admin_update on public.platform_settings;
create policy settings_admin_update on public.platform_settings for update to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists pages_owner_all on public.pages;
create policy pages_owner_all on public.pages for all to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = pages.project_id and p.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.projects p
  where p.id = pages.project_id and p.owner_id = (select auth.uid())
));

drop policy if exists api_keys_owner_read on public.api_keys;
create policy api_keys_owner_read on public.api_keys for select to authenticated
using (exists (
  select 1 from public.projects p
  where p.id = api_keys.project_id and p.owner_id = (select auth.uid())
));

-- These are initial persistent configuration values, not component mock data.
insert into public.platform_settings (key, value) values
  ('primary_color', '"#E76637"'::jsonb),
  ('hero_title', to_jsonb('Biến ý tưởng thành sản phẩm của riêng bạn'::text)),
  ('enable_ai_build', 'false'::jsonb)
on conflict (key) do nothing;

-- Atomic update of all three fields; RLS and column grants still apply.
create or replace function public.update_platform_settings(
  p_primary_color text, p_hero_title text, p_enable_ai_build boolean
)
returns setof public.platform_settings
language plpgsql security invoker set search_path = '' as $$
declare updated_count integer;
begin
  if not (select public.is_platform_admin()) then
    raise exception 'Only an admin can update platform settings' using errcode = '42501';
  end if;
  if p_primary_color is null or p_primary_color !~ '^#[0-9a-fA-F]{6}$'
    or p_hero_title is null or char_length(btrim(p_hero_title)) not between 1 and 160
    or p_enable_ai_build is null then
    raise exception 'Invalid platform settings' using errcode = '22023';
  end if;
  return query
    update public.platform_settings s
    set value = case s.key
      when 'primary_color' then to_jsonb(p_primary_color)
      when 'hero_title' then to_jsonb(btrim(p_hero_title))
      when 'enable_ai_build' then to_jsonb(p_enable_ai_build)
      else s.value end
    where s.key in ('primary_color', 'hero_title', 'enable_ai_build')
    returning s.*;
  get diagnostics updated_count = row_count;
  if updated_count <> 3 then
    raise exception 'Missing required platform settings' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.update_platform_settings(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_platform_settings(text, text, boolean) to authenticated;

-- Supabase Realtime must also be enabled for the project.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public'
         and tablename = 'platform_settings'
     ) then
    alter publication supabase_realtime add table public.platform_settings;
  end if;
end;
$$;

commit;
