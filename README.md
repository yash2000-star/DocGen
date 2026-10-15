# DocGen

DocGen turns a GitHub repository into a polished, Mintlify-style documentation site. An AI "architect" plans the site, a "ghostwriter" writes each page, and a "critic" cleans up the result. You get introduction, quickstart, guide and reference pages instead of one page per file.

> **Status:** early development. The core flow (import a repo → generate → view docs) works locally. Bring-your-own AI key, a job queue and security hardening are next on the roadmap.

## How it works

```
frontend/   React 19 + Vite dashboard and docs viewer
backend/    Express 5 API: auth, generation pipeline, billing, Ask AI
build/      Build worker: docs/<tenant>/<project>/*.mdx → dist/ (sidebar, search index, embeddings)
lib/        Shared helpers (docs.json loader, llms.txt / skill.md generator)
supabase/   Database schema and Row-Level Security policies
```

1. You import `https://github.com/<owner>/<repo>` from the dashboard.
2. The backend clones it, plans 5–10 pages and writes them to `docs/<owner>/<repo>/`.
3. `build/build.js` compiles the pages into `dist/` and indexes them for search and Ask AI.
4. The docs are published at `/docs/<owner>/<repo>`.

## Run it locally

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project
- A [Gemini API key](https://aistudio.google.com/apikey) to generate docs

### 1. Set up the database

Apply the schema in `supabase/migrations/` to your Supabase project. Use one of these:

- **Supabase CLI:** `supabase link --project-ref <your-ref>` then `supabase db push`
- **Dashboard:** open **SQL Editor**, paste the contents of `supabase/migrations/20261015000000_initial_schema.sql`, and run it.

### 2. Turn on sign-in

In the Supabase dashboard, open **Authentication → Providers**:

- **GitHub:** create a GitHub OAuth app whose callback URL is `https://<your-ref>.supabase.co/auth/v1/callback`, then paste its client ID and secret into Supabase.
- **Email:** enabled by default (sign in with a one-time code).

Then open **Authentication → URL Configuration** and add `http://localhost:5173/**` to **Redirect URLs**.

### 3. Configure environment variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Fill in the values. You'll find the Supabase URL and keys under **Project Settings → API**.

| File | Variable | Required | What it's for |
|---|---|---|---|
| `backend/.env` | `SUPABASE_URL` | Yes | Your Supabase project URL |
| `backend/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Yes | Lets the backend write data. Keep it secret. |
| `backend/.env` | `GEMINI_API_KEY` | To generate docs | Writer, critic, search embeddings, Ask AI |
| `backend/.env` | `RAZORPAY_*` | No | Billing. Leave empty to turn it off. |
| `backend/.env` | `EMAIL_USER`, `EMAIL_PASS` | No | "Your docs are ready" emails |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Yes | Sign-in and dashboard data |
| `frontend/.env` | `VITE_API_URL` | Yes | Backend address, `http://localhost:4000` by default |

When the backend starts, it lists any optional features that are turned off and the variable that turns each one on.

### 4. Install and start

```bash
npm run setup          # installs root, backend and frontend dependencies
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173 (in a second terminal)
```

Open `http://localhost:5173`, sign in, and import a public GitHub repository.

To try the free preview without signing in, visit `http://localhost:5173/<owner>/<repo>`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing required environment variables` on start | Create `backend/.env` from `backend/.env.example`. |
| `AI writer is not configured` when generating | Set `GEMINI_API_KEY` in `backend/.env` and restart the backend. |
| Sign-in redirects to the wrong place | Add `http://localhost:5173/**` to Supabase redirect URLs. |
| `relation "public.projects" does not exist` | The database schema hasn't been applied. See step 1. |
| Docs page says "Document not found" | Wait for the build to finish. The project status turns **Successful** on the dashboard when it does. |

## Project layout

| Path | Contents |
|---|---|
| `backend/server.js` | API routes |
| `backend/services/generationPipeline.js` | Clone → plan → write → save pipeline shared by the dashboard and free preview |
| `backend/aiWriter.js`, `backend/aiEditor.js` | Architect, ghostwriter and critic prompts |
| `backend/config.js` | All environment configuration |
| `build/build.js` | Static build, search index and embeddings |
| `frontend/src/pages/DocEngine.jsx` | Public docs viewer |
| `supabase/migrations/` | Database schema, RLS policies, SQL functions |

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.
