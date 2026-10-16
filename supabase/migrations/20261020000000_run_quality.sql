-- Step 7: each generation run records a quality report.
--   { pagesChecked, issuesFound, issuesFixed, remaining: [{ page, kind, value }],
--     apiReference: { specPath, operations, tags, truncated } | null }
-- "issues" are references a page made to things the repository doesn't contain (files,
-- environment variables, npm scripts, packages, pages), found by backend/quality/factCheck.js.
alter table public.build_events add column quality jsonb;

-- Members read it in the activity feed (build_events uses column grants, see the job
-- queue migration).
grant select (quality) on public.build_events to authenticated;
