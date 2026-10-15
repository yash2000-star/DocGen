-- Step 5: generation runs become background jobs.
--
-- Each row in build_events is now a job. The API inserts it as 'queued' and returns at
-- once; a worker claims it, runs it, reports progress, and records the result. Jobs that
-- fail for a temporary reason are retried with backoff, and jobs whose worker stops
-- responding (crash, deploy, restart) are picked up again.
--
--   queued → running → successful | failed | cancelled
--              ↑   │
--              └───┘ temporary failure, or the worker stopped responding (until max_attempts)

-- Runs left 'running' by the old in-request pipeline will never finish.
update public.build_events
   set status = 'failed', error_message = 'Interrupted (started before the job queue existed).', finished_at = now()
 where status not in ('successful', 'failed');

alter table public.build_events
  add column payload          jsonb       not null default '{}'::jsonb, -- what to run (repo, user, files...)
  add column attempts         integer     not null default 0,
  add column max_attempts     integer     not null default 3,
  add column run_after        timestamptz not null default now(),       -- retry backoff
  add column locked_by        text,                                     -- worker running it
  add column started_at       timestamptz,
  add column heartbeat_at     timestamptz,
  add column progress         jsonb       not null default '{}'::jsonb, -- { step, message, pagesDone, pagesTotal }
  add column cancel_requested boolean     not null default false;

alter table public.build_events
  add constraint build_events_status_check
  check (status in ('queued', 'running', 'successful', 'failed', 'cancelled'));

-- One job waiting and one running per project at most: a second "regenerate" click or a
-- burst of pushes can't stack up work, and two workers never write the same docs at once.
create unique index build_events_one_queued_per_project on public.build_events (project_id) where status = 'queued';
create unique index build_events_one_running_per_project on public.build_events (project_id) where status = 'running';
create index build_events_queue_idx on public.build_events (run_after, created_at) where status = 'queued';

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects
  add constraint projects_status_check
  check (status in ('pending', 'queued', 'running', 'building', 'successful', 'live', 'failed'));

-- Members read jobs in the activity feed, but not the payload (it can hold the requester's
-- email for a preview) or the worker id. Column grants keep those two server-side.
revoke select on public.build_events from anon, authenticated;
grant select (id, project_id, event_type, status, triggered_by, files_count, created_at,
              provider, model, input_tokens, output_tokens, error_message, finished_at,
              attempts, max_attempts, run_after, started_at, heartbeat_at, progress, cancel_requested)
  on public.build_events to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- Claims the next job that's ready, for one worker.
-- SKIP LOCKED lets many workers poll at once without taking the same job, and a project
-- whose previous job is still running is skipped until that job finishes.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.claim_next_job(p_worker text)
returns setof public.build_events
language sql
set search_path = ''
as $$
  update public.build_events b
     set status       = 'running',
         locked_by    = p_worker,
         started_at   = coalesce(b.started_at, now()),
         heartbeat_at = now(),
         attempts     = b.attempts + 1,
         progress     = jsonb_build_object('step', 'starting', 'message', 'Starting')
   where b.id = (
           select q.id
             from public.build_events q
            where q.status = 'queued'
              and q.run_after <= now()
              and not q.cancel_requested
              and not exists (
                    select 1 from public.build_events r
                     where r.project_id = q.project_id and r.status = 'running')
            order by q.run_after, q.created_at
            for update skip locked
            limit 1)
  returning b.*;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Recovers jobs whose worker stopped sending heartbeats.
-- They go back to the queue (after p_retry_seconds) until they run out of attempts.
-- Returns the ids it changed.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.requeue_stale_jobs(p_stale_seconds integer, p_retry_seconds integer)
returns setof uuid
language plpgsql
set search_path = ''
as $$
declare
  job record;
  can_retry boolean;
begin
  for job in
    select id, project_id, attempts, max_attempts, cancel_requested
      from public.build_events
     where status = 'running'
       and heartbeat_at < now() - make_interval(secs => p_stale_seconds)
       for update skip locked
  loop
    -- Retry only if attempts remain, it wasn't cancelled, and no newer job is waiting.
    can_retry := job.attempts < job.max_attempts
             and not job.cancel_requested
             and not exists (select 1 from public.build_events w
                              where w.project_id = job.project_id and w.status = 'queued');

    if can_retry then
      update public.build_events
         set status = 'queued', locked_by = null, heartbeat_at = null,
             run_after = now() + make_interval(secs => p_retry_seconds),
             progress = jsonb_build_object('step', 'queued', 'message', 'Waiting to retry: the worker stopped responding.')
       where id = job.id;
      update public.projects set status = 'queued' where id = job.project_id;
    else
      update public.build_events
         set status = case when job.cancel_requested then 'cancelled' else 'failed' end,
             locked_by = null, finished_at = now(),
             error_message = case when job.cancel_requested then error_message
                                  else 'The worker running this job stopped responding.' end
       where id = job.id;
      update public.projects set status = 'failed' where id = job.project_id;
    end if;

    return next job.id;
  end loop;
end;
$$;

revoke execute on function public.claim_next_job(text) from public, anon, authenticated;
revoke execute on function public.requeue_stale_jobs(integer, integer) from public, anon, authenticated;
