-- Step 6: security hardening.
--
-- 1. Project namespaces belong to their GitHub owner. A docs site lives at
--    /docs/<owner>/<repo>, which readers take as the official docs of that repository, so
--    only the GitHub user <owner> may create or claim it, and only from that repository.
--    (Organization repositories need a GitHub App to verify membership: a later step.)
-- 2. Each project has its own GitHub webhook secret, so one user can't forge pushes for
--    another user's project.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Verified namespaces
-- ═══════════════════════════════════════════════════════════════════════════

-- True if repo_url is https://github.com/<tenant>/<project> (any case, optional .git or /).
create or replace function public.repo_url_matches(p_repo_url text, p_tenant text, p_project text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_repo_url is null
      or lower(regexp_replace(p_repo_url, '(\.git)?/?$', ''))
         = 'https://github.com/' || lower(p_tenant) || '/' || lower(p_project);
$$;

-- Checks every change users make through the API (the backend's service role is trusted:
-- it validates its own writes, and the anonymous preview creates unowned projects).
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
  else
    if new.tenant_name is distinct from old.tenant_name or new.project_name is distinct from old.project_name then
      raise exception 'A project''s repository can''t be changed.' using errcode = '42501';
    end if;
    -- Claiming an unowned preview is allowed (RLS checks the GitHub login); moving an owned
    -- project to someone else is not.
    if old.user_id is not null and new.user_id is distinct from old.user_id then
      raise exception 'Projects can''t be transferred.' using errcode = '42501';
    end if;
  end if;

  if not public.repo_url_matches(new.repo_url, new.tenant_name, new.project_name) then
    raise exception 'The repository URL must be https://github.com/%/%.', new.tenant_name, new.project_name
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger projects_enforce_namespace
  before insert or update on public.projects
  for each row execute function public.enforce_project_namespace();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Per-project webhook secrets
-- ═══════════════════════════════════════════════════════════════════════════

-- A separate table with RLS and no policies: only the backend (service role) can read it.
-- Secrets are encrypted by the backend (AES-256-GCM with AI_KEY_ENCRYPTION_KEY, like AI
-- keys), so a database leak doesn't let anyone sign pushes.
create table public.project_secrets (
  project_id                uuid primary key references public.projects (id) on delete cascade,
  webhook_secret_encrypted  text not null,
  created_at                timestamptz not null default now()
);

alter table public.project_secrets enable row level security;
revoke all on public.project_secrets from anon, authenticated;
