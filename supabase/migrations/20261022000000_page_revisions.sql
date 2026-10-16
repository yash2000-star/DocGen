-- Step 9: page history, and AI suggestions for pages people edited by hand.
--
-- The docs files (docs/<owner>/<repo>/*.mdx) stay the source of truth. Every change to a
-- page also records a revision here, so any earlier version can be viewed and restored.
--
-- A page whose latest revision was written by a person (in the editor, or by restoring a
-- version) is "edited by hand". Generation and push updates never overwrite it: they save
-- their new version as a suggestion (kind = 'suggestion'), which an editor can accept or
-- dismiss.


create table public.page_revisions (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  route       text not null check (char_length(route) between 1 and 300),
  -- 'revision': a version that was published. 'suggestion': an AI update waiting for review.
  kind        text not null default 'revision' check (kind in ('revision', 'suggestion')),
  -- Who wrote it: 'generation' or 'update' (AI), 'editor' or 'restore' (a person).
  source      text not null check (source in ('generation', 'update', 'editor', 'restore', 'baseline')),
  content     text not null check (char_length(content) <= 500000),
  deleted     boolean not null default false,  -- the page was deleted in this revision
  author_id   uuid references auth.users (id) on delete set null,
  job_id      uuid references public.build_events (id) on delete set null,
  message     text check (message is null or char_length(message) <= 300),
  created_at  timestamptz not null default now()
);

create index page_revisions_page_idx on public.page_revisions (project_id, route, created_at desc);
create index page_revisions_suggestions_idx on public.page_revisions (project_id) where kind = 'suggestion';

alter table public.page_revisions enable row level security;

-- Project members can read the history in the dashboard. Only the backend writes it.
create policy "Members can read page revisions"
  on public.page_revisions for select
  to authenticated
  using (public.project_role(project_id) is not null);

revoke insert, update, delete on public.page_revisions from anon, authenticated;
