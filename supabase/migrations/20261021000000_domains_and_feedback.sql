-- Step 8: verified custom domains, and reader feedback.


-- ═══════════════════════════════════════════════════════════════════════════
-- Custom domains must be verified (DNS TXT record) before they serve docs
-- ═══════════════════════════════════════════════════════════════════════════
-- Several projects may claim a domain while unverified; the first to prove ownership gets
-- it. Before, the first project to type a domain held it, verified or not.
alter table public.projects drop constraint if exists projects_custom_domain_key;
alter table public.projects
  add column custom_domain_token       text,         -- expected in the TXT record
  add column custom_domain_verified_at timestamptz;  -- set by the backend after checking DNS

create unique index projects_verified_custom_domain on public.projects (lower(custom_domain))
  where custom_domain_verified_at is not null;

-- Existing domains were never verified.
update public.projects set custom_domain_verified_at = null where custom_domain is not null;

-- Users change domains through the backend (Settings → Domain setup), which issues the
-- verification token and checks DNS. Direct API writes to these columns are refused.
create or replace function public.enforce_project_namespace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  github_login text := public.current_github_username();
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if github_login is null then
      raise exception 'Sign in with GitHub to create a docs site for your repositories.'
        using errcode = '42501';
    end if;
    if lower(new.tenant_name) <> lower(github_login) then
      raise exception 'You can only create docs for repositories under your GitHub account (%).', github_login
        using errcode = '42501';
    end if;
    if new.custom_domain is not null or new.custom_domain_token is not null or new.custom_domain_verified_at is not null then
      raise exception 'Set a custom domain in the project''s Domain setup settings.' using errcode = '42501';
    end if;
  else
    if new.tenant_name is distinct from old.tenant_name or new.project_name is distinct from old.project_name then
      raise exception 'A project''s repository can''t be changed.' using errcode = '42501';
    end if;
    if old.user_id is not null and new.user_id is distinct from old.user_id then
      raise exception 'Projects can''t be transferred.' using errcode = '42501';
    end if;
    if new.custom_domain is distinct from old.custom_domain
       or new.custom_domain_token is distinct from old.custom_domain_token
       or new.custom_domain_verified_at is distinct from old.custom_domain_verified_at then
      raise exception 'Set a custom domain in the project''s Domain setup settings.' using errcode = '42501';
    end if;
  end if;

  if not public.repo_url_matches(new.repo_url, new.tenant_name, new.project_name) then
    raise exception 'The repository URL must be https://github.com/%/%.', new.tenant_name, new.project_name
      using errcode = '42501';
  end if;
  return new;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Reader feedback: "Was this page helpful?"
-- ═══════════════════════════════════════════════════════════════════════════
create table public.page_feedback (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  route       text not null check (char_length(route) between 1 and 300),
  helpful     boolean not null,
  comment     text check (comment is null or char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);

create index page_feedback_project_idx on public.page_feedback (project_id, created_at desc);

alter table public.page_feedback enable row level security;

-- Readers are anonymous: feedback is written by the backend (rate limited). Project
-- members read it in the dashboard.
create policy "Members can read feedback"
  on public.page_feedback for select
  to authenticated
  using (public.project_role(project_id) is not null);

revoke insert, update, delete on public.page_feedback from anon, authenticated;
