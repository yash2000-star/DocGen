-- DocGen initial schema
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the
-- Supabase SQL editor. Every table used by the frontend and backend is here.
--
-- Access model:
--   * The backend uses the service-role key, which bypasses Row-Level Security.
--   * The frontend uses the anon key, so every table it touches has RLS policies.
--   * Anonymous visitors get no table access; published docs are served by the backend.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;


-- ═══════════════════════════════════════════════════════════════════════════
-- Shared trigger: keep updated_at current
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- users: profile and billing state, one row per auth user
-- ═══════════════════════════════════════════════════════════════════════════

create table public.users (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    text,
  full_name                text not null default '',
  github_username          text not null default '',
  avatar_url               text not null default '',
  plan                     text not null default 'free'
                           check (plan in ('free', 'pro', 'enterprise')),
  plan_status              text not null default 'active'
                           check (plan_status in ('active', 'cancelled', 'halted')),
  plan_current_end         timestamptz,
  razorpay_customer_id     text,
  razorpay_subscription_id text unique,
  created_at               timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  to authenticated
  using (id = (select auth.uid()));

-- The frontend creates the row on first login. Billing fields can only be set
-- by the backend, so a new row must start on the free plan.
create policy "Users can create their own free profile"
  on public.users for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and plan = 'free'
    and plan_status = 'active'
    and plan_current_end is null
    and razorpay_customer_id is null
    and razorpay_subscription_id is null
  );

-- Also create the row server-side whenever someone signs up, so it always exists.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name, github_username, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'user_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();


-- ═══════════════════════════════════════════════════════════════════════════
-- projects: one documentation site per GitHub repo (tenant = repo owner)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  -- null for "orphan" projects created by the anonymous free preview
  user_id       uuid references auth.users (id) on delete set null,
  tenant_name   text not null,
  project_name  text not null,
  repo_url      text,
  status        text not null default 'pending'
                check (status in ('pending', 'running', 'building', 'successful', 'live', 'failed')),
  file_count    integer not null default 0,
  custom_domain text unique,
  primary_color text,
  logo_url      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_name, project_name)
);

create index projects_user_id_idx on public.projects (user_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════
-- project_members: who can work on a project, and with which role
-- ═══════════════════════════════════════════════════════════════════════════

create table public.project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create index project_members_user_id_idx on public.project_members (user_id);

-- The current user's role on a project ('admin' for the owner), or null.
-- SECURITY DEFINER so policies can call it without recursing through RLS.
create or replace function public.project_role(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.projects p
      where p.id = p_project_id and p.user_id = (select auth.uid())
    ) then 'admin'
    else (
      select m.role from public.project_members m
      where m.project_id = p_project_id and m.user_id = (select auth.uid())
    )
  end;
$$;

-- The signed-in user's GitHub username, read from their GitHub identity.
-- Used to let people claim preview projects generated for their repos.
-- (Read from auth.identities, not user_metadata, because users can edit user_metadata.)
create or replace function public.current_github_username()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
  from auth.identities i
  where i.user_id = (select auth.uid()) and i.provider = 'github'
  limit 1;
$$;

-- Whoever owns a project is automatically its admin member.
create or replace function public.add_owner_as_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null
     and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    insert into public.project_members (project_id, user_id, role)
    values (new.id, new.user_id, 'admin')
    on conflict (project_id, user_id) do update set role = 'admin';
  end if;
  return new;
end;
$$;

create trigger projects_add_owner_as_admin
  after insert or update of user_id on public.projects
  for each row execute function public.add_owner_as_admin();

alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- The user_id check matters for claiming: Postgres also checks the updated row
-- against SELECT policies, before the trigger has added the membership row.
create policy "Members can read their projects"
  on public.projects for select
  to authenticated
  using (user_id = (select auth.uid()) or public.project_role(id) is not null);

-- Needed to claim a preview project: UPDATE only reaches rows the user can SELECT.
create policy "Users can see preview projects for their GitHub repos"
  on public.projects for select
  to authenticated
  using (user_id is null and tenant_name = public.current_github_username());

create policy "Users can create projects they own"
  on public.projects for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Admins can update their projects"
  on public.projects for update
  to authenticated
  using (public.project_role(id) = 'admin')
  with check (public.project_role(id) = 'admin');

create policy "Users can claim preview projects for their GitHub repos"
  on public.projects for update
  to authenticated
  using (user_id is null and tenant_name = public.current_github_username())
  with check (user_id = (select auth.uid()));

create policy "Owners can delete their projects"
  on public.projects for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Members can see the members of their projects"
  on public.project_members for select
  to authenticated
  using (user_id = (select auth.uid()) or public.project_role(project_id) is not null);


-- ═══════════════════════════════════════════════════════════════════════════
-- pages: documents edited in the web editor
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  file_path   text not null,
  content     text not null default '',
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, file_path)
);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

alter table public.pages enable row level security;

create policy "Members can read pages"
  on public.pages for select
  to authenticated
  using (public.project_role(project_id) is not null);

create policy "Editors can create pages"
  on public.pages for insert
  to authenticated
  with check (public.project_role(project_id) in ('admin', 'editor'));

create policy "Editors can update pages"
  on public.pages for update
  to authenticated
  using (public.project_role(project_id) in ('admin', 'editor'))
  with check (public.project_role(project_id) in ('admin', 'editor'));

create policy "Editors can delete pages"
  on public.pages for delete
  to authenticated
  using (public.project_role(project_id) in ('admin', 'editor'));


-- ═══════════════════════════════════════════════════════════════════════════
-- build_events and page_views: project activity and analytics (read-only for users)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.build_events (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  event_type   text not null,
  status       text not null,
  files_count  integer not null default 0,
  triggered_by text,
  created_at   timestamptz not null default now()
);

create index build_events_project_id_idx on public.build_events (project_id, created_at desc);

create table public.page_views (
  id                 bigint generated always as identity primary key,
  project_id         uuid not null references public.projects (id) on delete cascade,
  route              text,
  visitor_session_id text,
  created_at         timestamptz not null default now()
);

create index page_views_project_id_idx on public.page_views (project_id, created_at desc);

alter table public.build_events enable row level security;
alter table public.page_views enable row level security;

create policy "Members can read build events"
  on public.build_events for select
  to authenticated
  using (public.project_role(project_id) is not null);

create policy "Members can read page views"
  on public.page_views for select
  to authenticated
  using (public.project_role(project_id) is not null);


-- ═══════════════════════════════════════════════════════════════════════════
-- user_onboarding: the getting-started checklist in the dashboard navbar
-- ═══════════════════════════════════════════════════════════════════════════

create table public.user_onboarding (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  imported_repo       boolean not null default false,
  viewed_docs         boolean not null default false,
  tried_ask_ai        boolean not null default false,
  configured_brand    boolean not null default false,
  added_custom_domain boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger user_onboarding_set_updated_at
  before update on public.user_onboarding
  for each row execute function public.set_updated_at();

alter table public.user_onboarding enable row level security;

create policy "Users can read their onboarding"
  on public.user_onboarding for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their onboarding"
  on public.user_onboarding for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their onboarding"
  on public.user_onboarding for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ═══════════════════════════════════════════════════════════════════════════
-- usage_tracking: monthly counters for plan limits (written by the backend)
-- ═══════════════════════════════════════════════════════════════════════════

create table public.usage_tracking (
  user_id     uuid not null references auth.users (id) on delete cascade,
  month       text not null check (month ~ '^\d{4}-\d{2}$'), -- 'YYYY-MM'
  generations integer not null default 0,
  ai_queries  integer not null default 0,
  primary key (user_id, month)
);

alter table public.usage_tracking enable row level security;

create policy "Users can read their usage"
  on public.usage_tracking for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.increment_usage(p_user_id uuid, p_month text, p_field text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_field not in ('generations', 'ai_queries') then
    raise exception 'increment_usage: unknown field %', p_field;
  end if;

  insert into public.usage_tracking (user_id, month, generations, ai_queries)
  values (
    p_user_id,
    p_month,
    case when p_field = 'generations' then 1 else 0 end,
    case when p_field = 'ai_queries' then 1 else 0 end
  )
  on conflict (user_id, month) do update set
    generations = public.usage_tracking.generations + excluded.generations,
    ai_queries  = public.usage_tracking.ai_queries + excluded.ai_queries;
end;
$$;

revoke execute on function public.increment_usage(uuid, text, text) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- doc_vectors: embeddings for Ask AI (written by build/build.js)
-- ═══════════════════════════════════════════════════════════════════════════

-- gemini-embedding-001 returns 3072 dimensions by default. If you switch embedding
-- models, change the dimension here and in match_vectors.
-- No ANN index: pgvector's HNSW/IVFFlat indexes support at most 2000 dimensions,
-- and the per-project filter keeps each search small.
create table public.doc_vectors (
  id         bigint generated always as identity primary key,
  tenant     text not null,
  version    text not null,
  route      text not null,
  text       text not null,
  embedding  extensions.vector(3072) not null,
  created_at timestamptz not null default now()
);

create index doc_vectors_project_idx on public.doc_vectors (tenant, version, route);

-- RLS on with no policies: only the backend (service role) can read or write.
alter table public.doc_vectors enable row level security;

create or replace function public.match_vectors(
  query_embedding extensions.vector(3072),
  match_threshold double precision,
  match_count     integer,
  search_tenant   text,
  search_version  text
)
returns table (id bigint, route text, text text, similarity double precision)
language sql
stable
set search_path = public, extensions
as $$
  select
    v.id,
    v.route,
    v.text,
    1 - (v.embedding <=> query_embedding) as similarity
  from public.doc_vectors v
  where v.tenant = search_tenant
    and v.version = search_version
    and 1 - (v.embedding <=> query_embedding) > match_threshold
  order by v.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_vectors(extensions.vector, double precision, integer, text, text)
  from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Realtime: the dashboard listens for project status changes
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.projects;
  end if;
end;
$$;
