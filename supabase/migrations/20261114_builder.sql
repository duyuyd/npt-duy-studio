-- Additive migration for the existing NPT Duy Studio database.
begin;
insert into public.platform_settings (key, value) values
  ('hero_subtitle', to_jsonb('Tạo dự án, sắp xếp giao diện trực quan và xuất mã nguồn từ một không gian làm việc.'::text))
on conflict (key) do nothing;

create or replace function public.update_platform_settings_v2(p_primary_color text, p_hero_title text, p_hero_subtitle text, p_enable_ai_build boolean)
returns setof public.platform_settings language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if not (select public.is_platform_admin()) then raise exception 'Only an admin can update platform settings' using errcode = '42501'; end if;
  if p_primary_color is null or p_primary_color !~ '^#[0-9a-fA-F]{6}$' or p_hero_title is null or char_length(btrim(p_hero_title)) not between 1 and 160
     or p_hero_subtitle is null or char_length(btrim(p_hero_subtitle)) not between 1 and 500 or p_enable_ai_build is null then
    raise exception 'Invalid platform settings' using errcode = '22023';
  end if;
  return query update public.platform_settings s set value = case s.key
    when 'primary_color' then to_jsonb(p_primary_color) when 'hero_title' then to_jsonb(btrim(p_hero_title))
    when 'hero_subtitle' then to_jsonb(btrim(p_hero_subtitle)) when 'enable_ai_build' then to_jsonb(p_enable_ai_build) else s.value end
    where s.key in ('primary_color','hero_title','hero_subtitle','enable_ai_build') returning s.*;
  get diagnostics changed = row_count;
  if changed <> 4 then raise exception 'Missing required platform settings' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.update_platform_settings_v2(text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.update_platform_settings_v2(text,text,text,boolean) to authenticated;

alter table public.pages add column if not exists revision integer not null default 0;

create or replace function public.create_studio_project(p_name text, p_type text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 or p_type is null or p_type not in ('web','app') then
    raise exception 'Invalid project' using errcode = '22023';
  end if;
  insert into public.projects(owner_id, name, type) values (auth.uid(), btrim(p_name), p_type) returning id into new_id;
  insert into public.pages(project_id, path, ui_tree) values (new_id, '/', '{"nodes":[]}'::jsonb);
  return new_id;
end;
$$;
revoke all on function public.create_studio_project(text,text) from public, anon, authenticated;
grant execute on function public.create_studio_project(text,text) to authenticated;

create or replace function public.save_page_tree(p_page_id uuid, p_revision integer, p_tree jsonb)
returns table(new_revision integer, saved_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if jsonb_typeof(p_tree) is distinct from 'object' or jsonb_typeof(p_tree->'nodes') is distinct from 'array'
     or octet_length(p_tree::text) > 250000 or p_revision is null or p_revision < 0 then
    raise exception 'Invalid page tree' using errcode = '22023';
  end if;
  return query update public.pages p set ui_tree = p_tree, revision = p.revision + 1
    where p.id = p_page_id and p.revision = p_revision
    returning p.revision, p.updated_at;
end;
$$;
revoke all on function public.save_page_tree(uuid,integer,jsonb) from public, anon, authenticated;
grant execute on function public.save_page_tree(uuid,integer,jsonb) to authenticated;

create table if not exists public.build_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  page_revision integer not null check (page_revision >= 0),
  ui_tree jsonb not null check (jsonb_typeof(ui_tree) = 'object' and octet_length(ui_tree::text) <= 250000),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  object_key text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists build_jobs_project_created_idx on public.build_jobs(project_id, created_at desc);
create unique index if not exists build_jobs_one_active_per_owner on public.build_jobs(owner_id) where status in ('queued','running');
alter table public.build_jobs enable row level security;
revoke all on public.build_jobs from public, anon, authenticated;
grant select on public.build_jobs to authenticated;
grant insert (project_id, owner_id, platform, page_revision, ui_tree) on public.build_jobs to authenticated;
do $$
begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'build_jobs' and policyname = 'build_jobs_read_owner') then
    create policy build_jobs_read_owner on public.build_jobs for select to authenticated using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'build_jobs' and policyname = 'build_jobs_create_owner') then
    create policy build_jobs_create_owner on public.build_jobs for insert to authenticated with check (
      owner_id = auth.uid() and exists (select 1 from public.projects p where p.id = build_jobs.project_id and p.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_catalog.pg_trigger where tgname = 'build_jobs_updated_at' and tgrelid = 'public.build_jobs'::regclass and not tgisinternal) then
    create trigger build_jobs_updated_at before update on public.build_jobs for each row execute function public.set_updated_at();
  end if;
end;
$$;

create or replace function public.create_studio_build(p_project_id uuid, p_platform text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb; page_rev integer; new_id uuid;
begin
  if auth.uid() is null or p_platform is null or p_platform not in ('android','ios') then raise exception 'Invalid request' using errcode = '42501'; end if;
  select p.ui_tree, p.revision into snapshot, page_rev from public.pages p
    where p.project_id = p_project_id and p.path = '/';
  if snapshot is null then raise exception 'Project not found' using errcode = '42501'; end if;
  insert into public.build_jobs(project_id, owner_id, platform, page_revision, ui_tree)
    values (p_project_id, auth.uid(), p_platform, page_rev, snapshot) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.create_studio_build(uuid,text) from public, anon, authenticated;
grant execute on function public.create_studio_build(uuid,text) to authenticated;

create or replace function public.fail_undispatched_build(p_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.build_jobs set status = 'failed', error_message = 'Không thể gửi yêu cầu tới hệ thống build.'
  where id = p_job_id and owner_id = auth.uid() and status = 'queued';
end;
$$;
revoke all on function public.fail_undispatched_build(uuid) from public, anon, authenticated;
grant execute on function public.fail_undispatched_build(uuid) to authenticated;
commit;
