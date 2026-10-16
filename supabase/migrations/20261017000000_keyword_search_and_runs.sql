-- Step 3 of bring-your-own-key:
--   * Ask AI finds relevant doc sections with Postgres full-text search instead of
--     embeddings, so it works with every AI provider (Anthropic has no embeddings API).
--   * build_events records each generation run: who ran it, which model, tokens, errors.


-- ═══════════════════════════════════════════════════════════════════════════
-- doc_chunks: one row per doc section, searchable by keyword (written by build/build.js)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.match_vectors(extensions.vector, double precision, integer, text, text);
drop table if exists public.doc_vectors;

create table public.doc_chunks (
  id         bigint generated always as identity primary key,
  tenant     text not null,
  version    text not null,
  route      text not null, -- page route, with #heading for sections
  title      text not null default '',
  text       text not null,
  -- Section titles count more than body text when ranking.
  search     tsvector generated always as (
               setweight(to_tsvector('english', title), 'A') ||
               setweight(to_tsvector('english', text), 'B')
             ) stored,
  created_at timestamptz not null default now()
);

create index doc_chunks_project_idx on public.doc_chunks (tenant, version, route);
create index doc_chunks_search_idx on public.doc_chunks using gin (search);

-- Backend only (service role), like the other AI tables.
alter table public.doc_chunks enable row level security;
revoke all on table public.doc_chunks from anon, authenticated;

-- Returns the sections that best match a question.
-- Words are matched with OR (not AND), so "How do I install the app?" still finds a
-- section that only mentions "install". Sections matching more words rank higher.
create or replace function public.search_doc_chunks(
  search_tenant  text,
  search_version text,
  query          text,
  match_count    integer default 5
)
returns table (id bigint, route text, title text, text text, rank real)
language sql
stable
set search_path = ''
as $$
  with q as (
    -- The question's words, stemmed the same way as the docs ('english'), then OR-ed.
    -- 'simple' keeps the already-stemmed words as they are.
    select to_tsquery('simple', string_agg(quote_literal(t.lexeme), ' | ')) as tsq
    from unnest(to_tsvector('english', query)) as t
  )
  select c.id, c.route, c.title, c.text, ts_rank_cd(c.search, q.tsq) as rank
  from public.doc_chunks c, q
  where q.tsq is not null
    and c.tenant = search_tenant
    and c.version = search_version
    and c.search @@ q.tsq
  order by rank desc, c.id
  limit greatest(1, least(match_count, 20));
$$;

revoke execute on function public.search_doc_chunks(text, text, text, integer) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- build_events: one row per generation run, shown in the project's activity feed
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.build_events
  add column provider      text,
  add column model         text,
  add column input_tokens  integer not null default 0,
  add column output_tokens integer not null default 0,
  add column error_message text,
  add column finished_at   timestamptz;
