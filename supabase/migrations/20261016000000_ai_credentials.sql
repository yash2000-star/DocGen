-- Bring-your-own-key: AI provider credentials saved by users.
--
-- Keys are encrypted by the backend (AES-256-GCM, see backend/lib/secretBox.js) before
-- they reach this table. The browser never reads this table: RLS is on with no policies
-- and API roles have no table privileges, so only the backend's service role can use it.

create table public.ai_credentials (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null
                 check (provider in ('anthropic', 'openai', 'gemini', 'openrouter', 'ollama', 'custom')),
  encrypted_key  text,          -- null for keyless self-hosted endpoints
  key_hint       text not null default '', -- last 4 characters, for display
  base_url       text,          -- only for providers with an editable base URL
  writer_model   text not null default '',
  critic_model   text not null default '',
  is_default     boolean not null default false,
  last_tested_at timestamptz,
  last_test_ok   boolean,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, provider)
);

-- At most one default provider per user.
create unique index ai_credentials_one_default_per_user
  on public.ai_credentials (user_id)
  where is_default;

create trigger ai_credentials_set_updated_at
  before update on public.ai_credentials
  for each row execute function public.set_updated_at();

alter table public.ai_credentials enable row level security;

revoke all on table public.ai_credentials from anon, authenticated;

-- Makes one of the user's providers the default in one transaction,
-- clearing the old default first so the "one default" index is never violated.
create or replace function public.set_default_ai_credential(p_user_id uuid, p_provider text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  found_row boolean;
begin
  select exists (
    select 1 from public.ai_credentials where user_id = p_user_id and provider = p_provider
  ) into found_row;

  if not found_row then
    return false;
  end if;

  update public.ai_credentials
     set is_default = false
   where user_id = p_user_id and is_default and provider <> p_provider;

  update public.ai_credentials
     set is_default = true
   where user_id = p_user_id and provider = p_provider;

  return true;
end;
$$;

revoke execute on function public.set_default_ai_credential(uuid, text) from public, anon, authenticated;
