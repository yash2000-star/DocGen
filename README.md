# DocGen

DocGen turns a GitHub repository into a polished, Mintlify-style documentation site, written by **your own AI**: connect a Claude, OpenAI, Gemini, OpenRouter or self-hosted model key, and DocGen does the rest. DocGen itself never pays for or resells AI. An AI "architect" plans the site, a "ghostwriter" writes each page, and a "critic" cleans up the result. You get introduction, quickstart, guide and reference pages instead of one page per file.

> **Status:** early development. The core flow (connect your AI key → import a repo → generate → view docs → Ask AI) works locally. A job queue and security hardening are next on the roadmap.

## How it works

```
frontend/   React 19 + Vite dashboard and docs viewer
backend/    Express 5 API: auth, generation pipeline, billing, Ask AI
build/      Build worker: docs/<tenant>/<project>/*.mdx → dist/ (sidebar, search index, Ask AI index)
lib/        Shared helpers (docs.json loader, llms.txt / skill.md generator)
supabase/   Database schema and Row-Level Security policies
```

1. You connect your AI provider and import `https://github.com/<owner>/<repo>` from the dashboard.
2. The backend clones it and, with your AI key, plans 5–10 pages and writes them to `docs/<owner>/<repo>/`. Large repos are summarized to fit the model: the most important files go in full, the rest are listed by name.
3. Every generated page must compile; one that doesn't goes back to your critic model with the error to fix. `build/build.js` then compiles each page on the server into a code-free tree (no `import`/`export`, `{expressions}` or event handlers; only known components and safe links) and indexes each section for search and Ask AI (Postgres full-text search, so it works with every provider).
4. The docs are published at `/docs/<owner>/<repo>`. The viewer only draws the compiled tree, so nothing written into a page, by the AI or by a repo's README, can run in readers' browsers. Readers' Ask AI questions are answered by the project owner's AI, using their critic model.
5. Each run is listed in the project's activity feed with the model used and the tokens it cost.

## Run it locally

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project
- An API key for at least one AI provider (Anthropic, OpenAI, Gemini, OpenRouter), or a self-hosted model via Ollama

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
| `backend/.env` | `AI_KEY_ENCRYPTION_KEY` | Yes, to generate docs | Encrypts the provider keys users connect. Generate with `openssl rand -base64 32` and keep a backup. |
| `backend/.env` | `PREVIEW_AI_PROVIDER`, `PREVIEW_AI_API_KEY` | No | A server-paid AI key for the anonymous free preview. Off when empty. |
| `backend/.env` | `GITHUB_WEBHOOK_SECRET` | No | Regenerate docs on every push. Off when empty. |
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

Open `http://localhost:5173` and sign in.

### 5. Connect your AI provider and generate

Go to **Import repository**: it links to **AI providers** (`/settings/ai`, also under each project's settings) until a provider is connected. Connect one of:

| Provider | What you need |
|---|---|
| Anthropic (Claude) | An API key. Defaults: writer `claude-opus-5-5`, critic `claude-sonnet-5-5` |
| OpenAI | An API key |
| Google Gemini | An API key |
| OpenRouter | An API key |
| Ollama | A running Ollama server (default `http://localhost:11434/v1`), no key |
| Any OpenAI-compatible endpoint | Its base URL, and a key if it needs one |

DocGen tests the key with the provider before saving it, then stores it encrypted. The browser only ever sees the last 4 characters. Your first connected provider becomes your default, and generation uses your default provider's writer and critic models. Then import a public GitHub repository.

> In production (`NODE_ENV=production`), endpoints on localhost or private networks are blocked unless you set `ALLOW_PRIVATE_AI_ENDPOINTS=true`.

To try the anonymous free preview, set `PREVIEW_AI_PROVIDER` and `PREVIEW_AI_API_KEY`, then visit `http://localhost:5173/<owner>/<repo>`.

### Optional: update docs on every push

Set `GITHUB_WEBHOOK_SECRET`, then add a webhook to the repository on GitHub: payload URL `https://<your-backend>/api/webhook`, content type `application/json`, the same secret, and the **push** event. Pages for changed files are rewritten with the project owner's AI key. Unsigned requests are refused.

## Tests

```bash
npm --prefix backend test
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Missing required environment variables` on start | Create `backend/.env` from `backend/.env.example`. |
| "Connect an AI provider in Settings → AI providers first" | Connect a provider at `/settings/ai`. |
| A run fails with "The API key was rejected" or "out of credit" | Fix the key or billing with your provider, then save the key again in **AI providers**. The activity feed shows the provider's message. |
| Ask AI says it isn't set up for these docs | The project owner hasn't connected an AI provider. |
| A page says "This page has a syntax error on line N" | The page's MDX doesn't compile, usually after a manual edit. Fix that line in the editor, which refuses to publish pages with syntax errors. |
| Sign-in redirects to the wrong place | Add `http://localhost:5173/**` to Supabase redirect URLs. |
| `relation "public.projects" does not exist` | The database schema hasn't been applied. See step 1. |
| "Saving AI keys isn't enabled on this server" | Set `AI_KEY_ENCRYPTION_KEY` in `backend/.env` and restart the backend. |
| "This saved key can't be decrypted" | `AI_KEY_ENCRYPTION_KEY` changed since the key was saved. Enter the key again in **Settings → AI providers**. |
| Docs page says "Document not found" | Wait for the build to finish. The project status turns **Successful** on the dashboard when it does. |

## Project layout

| Path | Contents |
|---|---|
| `backend/server.js` | API routes |
| `backend/services/generationPipeline.js` | Clone → plan → write → save pipeline shared by the dashboard and free preview |
| `backend/aiWriter.js`, `backend/aiEditor.js` | Architect, ghostwriter and critic prompts |
| `backend/ai/` | One client interface for Anthropic, OpenAI, Gemini and OpenAI-compatible providers |
| `backend/services/aiCredentials.js` | Encrypted storage and testing of users' own AI keys; `getUserLLM()` for generation |
| `backend/ai/sourceDigest.js` | Fits large repos into the prompt budget, most important files first |
| `backend/mdx/components.js` | The docs components pages may use, shared by the prompts, the compiler and the viewer |
| `backend/mdx/safeMdx.js` | Compiles a page into a code-free render tree |
| `frontend/src/components/mdx/SafeMdxRenderer.jsx` | Draws a compiled page in the browser |
| `backend/config.js` | All environment configuration |
| `build/build.js` | Static build, search index and Ask AI section index |
| `frontend/src/pages/DocEngine.jsx` | Public docs viewer |
| `supabase/migrations/` | Database schema, RLS policies, SQL functions |

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.
