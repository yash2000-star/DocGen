# DocGen

DocGen turns a GitHub repository into a polished, Mintlify-style documentation site, written by **your own AI**: connect a Claude, OpenAI, Gemini, OpenRouter or self-hosted model key, and DocGen does the rest. DocGen itself never pays for or resells AI. An AI "architect" plans the site, a "ghostwriter" writes each page, and a "critic" cleans up the result. You get introduction, quickstart, guide and reference pages instead of one page per file.

> **Status:** early development. The core flow (connect your AI key → import a repo → generate → view docs → Ask AI) works locally, with generation running as background jobs and the security basics in place (see [Security](#security)).

## How it works

```
frontend/   React 19 + Vite dashboard and docs viewer
backend/    Express 5 API: auth, job queue and worker, generation pipeline, billing, Ask AI
build/      Build worker: docs/<tenant>/<project>/*.mdx → dist/ (sidebar, search index, Ask AI index)
lib/        Shared helpers (docs.json loader, llms.txt / skill.md generator)
supabase/   Database schema and Row-Level Security policies
```

1. You connect your AI provider and import `https://github.com/<owner>/<repo>` from the dashboard. The request is queued as a job and answered at once; a worker picks it up and the page shows its real progress (cloning, planning, writing page 2 of 7, building). You can leave the page or cancel the run.
2. The worker clones it and, with your AI key, plans 5–10 pages and writes them to `docs/<owner>/<repo>/`. Large repos are summarized to fit the model: the most important files go in full, the rest are listed by name. The writer is told to describe only what the source shows, and the critic checks each draft against the same source.
3. **Fact check:** each page is checked against the repository, without AI, for invented file names, environment variables, npm scripts, packages and links to pages that don't exist. A page with problems goes back to your critic model once, with the exact list. Links that still point nowhere become plain text, and anything else left is listed on the run.
4. **API reference:** if the repo has an OpenAPI 3.x or Swagger 2.0 spec (`openapi.yaml`, `swagger.json`, or any YAML/JSON file starting with `openapi:`), DocGen builds an API reference from it, without AI. It has an overview plus one page per endpoint with parameters, request body, responses, cURL/JavaScript/Python samples and a "Try it" playground, grouped by tag in the sidebar. A push that changes the spec refreshes it.
5. Every generated page must compile; one that doesn't goes back to your critic model with the error to fix. `build/build.js` then compiles each page on the server into a code-free tree (no `import`/`export`, `{expressions}` or event handlers; only known components and safe links) and indexes each section for search and Ask AI (Postgres full-text search, so it works with every provider).
6. The docs are published at `/docs/<owner>/<repo>`, or at your own domain (see [Publishing your docs](#publishing-your-docs)). Each page is sent as complete HTML that search engines and AI crawlers can read, and the docs app takes over in the browser. The viewer only draws the compiled tree, so nothing written into a page, by the AI or by a repo's README, can run in readers' browsers. Readers' Ask AI questions are answered by the project owner's AI, using their critic model.
8. Each run is listed in the project's activity feed with its progress, the model used, the tokens it cost, the fact-check result and the API reference it built.

### Background jobs

Generations, free previews and push updates are jobs in the `build_events` table. Workers claim them with `FOR UPDATE SKIP LOCKED`, so several can share the queue safely.

- **One at a time per project:** a project has at most one running and one waiting job. Regenerating while a run is waiting points you at that run; pushes that arrive while an update is waiting are merged into it.
- **Retries:** a temporary failure (rate limit, provider outage, network) is retried up to 3 times with growing delays. A problem you have to fix, like a rejected key, a missing model or a repo with no code, fails at once with the reason.
- **Crash recovery:** running jobs send a heartbeat. If a worker dies, its job is picked up again after `JOB_STALE_SECONDS`. On a normal shutdown, running jobs go straight back to the queue.
- **Cancel:** from the progress page or the activity feed. A waiting job is cancelled at once; a running one stops after the page it's writing.
- **No half-written sites:** each run writes into its own folder under `repos/`, and pages are copied into `docs/` only when the whole run succeeds.

The API server runs up to `WORKER_CONCURRENCY` jobs (default 2). To scale workers separately, set `WORKER_CONCURRENCY=0` on the API server and run `npm --prefix backend run worker` as many times as you like.

## Publishing your docs

Every docs site has:

- **Pages search engines can read:** each page is served as finished HTML with its title, description, canonical URL, Open Graph and Twitter tags, and structured data. Unknown pages answer `404` and aren't indexed.
- **A sidebar with page titles, tabs, and previous/next links.** A site with an API reference gets **Documentation** and **API reference** tabs, each with its own sidebar. The layout comes from `site.json`, which the build writes next to the pages.
- **`sitemap.xml`, `llms.txt` and a Markdown copy of every page** (`/docs/<owner>/<repo>/quickstart.md`), so AI tools can read the docs. `/sitemap.xml` and `/robots.txt` cover every site on the server.
- **A page menu:** copy the page as Markdown, view it as Markdown, or open it in ChatGPT or Claude to ask about it.
- **"Was this page helpful?"** Readers answer Yes or No and can leave a comment. Answers appear in the project's **Analytics**, per page, with recent comments. Readers stay anonymous, and answers are rate limited.

### Run everything on one address (recommended in production)

Search engines see the full pages only when the backend serves the app too:

```bash
VITE_API_URL=https://docs.example.com npm --prefix frontend run build   # once per deploy
# backend/.env
PUBLIC_URL=https://docs.example.com
FRONTEND_URL=https://docs.example.com
SERVE_FRONTEND=true
```

The backend then serves the dashboard, the docs and the API from `PUBLIC_URL`. Without `SERVE_FRONTEND`, `/docs/...` on the backend still serves the readable HTML, and the frontend dev server shows the app.

### Custom domains

To serve a project's docs at `docs.yourcompany.com`, open the project's **Settings → Domain setup** and add the domain. DocGen shows two DNS records:

1. **TXT** `_docgen-verify.docs.yourcompany.com` with the value shown (`docgen-verify=…`), which proves you own the domain.
2. **CNAME** `docs.yourcompany.com` pointing at your DocGen server.

Click **Verify** once the TXT record is in place. The first project to verify a domain gets it, so nobody can claim a domain they don't control. The docs are then served at the domain's root (`https://docs.yourcompany.com/quickstart`), with links, sitemap, `llms.txt` and `robots.txt` for that domain.

DocGen doesn't issue certificates: put the domain behind a proxy that handles HTTPS (Caddy, Cloudflare, your load balancer) and forwards the original `Host` header. Requests for the app's own hostnames (`PUBLIC_URL`, `FRONTEND_URL`, localhost and `APP_HOSTNAMES`) are never treated as custom domains. If the frontend runs on its own hostname, add that hostname to `VITE_APP_HOSTNAMES` when building it.

## Run it locally

### Prerequisites

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project
- An API key for at least one AI provider (Anthropic, OpenAI, Gemini, OpenRouter), or a self-hosted model via Ollama

### 1. Set up the database

Apply the schema in `supabase/migrations/` to your Supabase project. Use one of these:

- **Supabase CLI:** `supabase link --project-ref <your-ref>` then `supabase db push`
- **Dashboard:** open **SQL Editor** and run each file in `supabase/migrations/`, oldest first.

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
| `backend/.env` | `PUBLIC_URL` | In production | The backend's public address, used for canonical URLs, sitemaps and custom domains. Defaults to `http://localhost:4000`. |
| `backend/.env` | `SERVE_FRONTEND`, `FRONTEND_DIST_DIR` | No | Serve the built app from the backend (see [Publishing your docs](#publishing-your-docs)) |
| `backend/.env` | `APP_HOSTNAMES` | No | Extra hostnames of the app itself, so they aren't treated as custom domains |
| `backend/.env` | `TRUST_PROXY` | In production behind a proxy | Proxy hops (usually `1`), so rate limits see visitors' real IPs |
| `backend/.env` | `RAZORPAY_*` | No | Billing. Leave empty to turn it off. |
| `backend/.env` | `EMAIL_USER`, `EMAIL_PASS` | No | "Your docs are ready" emails |
| `frontend/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Yes | Sign-in and dashboard data |
| `frontend/.env` | `VITE_API_URL` | Yes | Backend address, `http://localhost:4000` by default |
| `frontend/.env` | `VITE_APP_HOSTNAMES` | No | The app's own hostnames; any other hostname is treated as a docs custom domain |

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

DocGen tests the key with the provider before saving it, then stores it encrypted. The browser only ever sees the last 4 characters. Your first connected provider becomes your default, and generation uses your default provider's writer and critic models. Then import one of your own public GitHub repositories (you need to be signed in with GitHub).

> In production (`NODE_ENV=production`), endpoints on localhost or private networks are blocked unless you set `ALLOW_PRIVATE_AI_ENDPOINTS=true`.

To try the anonymous free preview, set `PREVIEW_AI_PROVIDER` and `PREVIEW_AI_API_KEY`, then visit `http://localhost:5173/<owner>/<repo>`.

### Optional: update docs on every push

Open the project's **Settings → Git settings**. It shows the payload URL and the project's own webhook secret. On GitHub, add a webhook to the repository with that URL and secret, content type `application/json`, and the **push** event. Pages for changed files are rewritten with the project owner's AI key, as a background job. Pushes that aren't signed with that project's secret are refused.

## Security

What protects DocGen users, and where it lives:

- **Who owns a docs site:** `/docs/<owner>/<repo>` can only be created or claimed by the GitHub user `<owner>`, from that repository. The database enforces this (`supabase/migrations/20261019000000_security_hardening.sql`), so it holds even for direct API calls. Sign-in with GitHub is needed to import repositories. Organization repositories aren't supported yet; they need a GitHub App to verify membership.
- **AI keys:** encrypted with AES-256-GCM (`AI_KEY_ENCRYPTION_KEY`) and never sent back to the browser. Custom AI endpoints can't point at localhost or private networks in production. The address is checked again when connecting, so DNS rebinding can't get around it.
- **Generated pages:** compiled on the server into a tree with no code. Nothing in a page can run in readers' browsers (see steps 5 and 6 in [How it works](#how-it-works)).
- **Repository contents:** symlinks in a repository are never followed, so a repo can't pull the server's own files (like `backend/.env`) into the AI prompt or the docs. Specs are parsed as plain data (YAML JSON schema).
- **API playground ("Try it"):** the backend proxy only calls public internet addresses, follows no redirects, sends no cookies or credentials, and limits time (10 s), response size (1 MB) and rate.
- **Webhooks:** each project has its own secret, stored encrypted. A push must be signed with the secret of the project it's for.
- **Custom domains:** a domain serves docs only after a DNS TXT record proves ownership, and only one project can verify it. The domain columns can only be changed through the backend.
- **Cross-site requests:** the dashboard API authenticates with a Bearer token, only accepts requests from the app's own origins, and refuses state-changing requests from other origins. Public reader endpoints (docs, Ask AI, feedback) accept any origin, without credentials, so docs on custom domains work.
- **Public pages:** server-rendered pages escape all page content and send a Content-Security-Policy.
- **Abuse limits:** Ask AI, reader feedback, domain checks, free previews (per visitor and per day), the API playground and webhooks are rate limited. Set `TRUST_PROXY` in production so limits apply per visitor.
- **Data exposure:** job payloads, worker ids and webhook secrets are hidden from users by database grants. The agent (MCP) endpoint serves only published pages. Errors never include stack traces.
- **Dependencies:** `npm audit` is clean for the root, backend and frontend packages at the time of writing. Run it before deploying.

Known gaps:
- Rate limits are kept in memory, so each backend instance counts separately. The daily preview cap is counted in the database.

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
| "You can only import repositories under your GitHub account" | Docs at `/docs/<owner>/<repo>` belong to the GitHub user `<owner>`. Sign in with that GitHub account. Organization repositories aren't supported yet. |
| "Sign in with GitHub to import repositories" | You signed in with email. Sign in with GitHub instead. |
| The API playground says it "can only call public APIs" | It can't reach localhost or private networks in production. For local testing, set `API_PLAYGROUND_ALLOW_PRIVATE=true`. |
| No API reference was generated | The spec must be OpenAPI 3.x or Swagger 2.0, at most 2 MB, outside test/example folders, and named like `openapi.yaml`/`swagger.json` or start with `openapi:`. The run's activity row says which spec was used. |
| The activity feed lists fact-check items left | The page still mentions things the repository doesn't have. Fix them in the editor, or regenerate. |
| Domain setup says "The TXT record wasn't found yet" | Check the record with `dig TXT _docgen-verify.<your-domain>`. DNS changes can take a few minutes to appear. |
| A verified custom domain shows the DocGen dashboard instead of the docs | The domain is listed as one of the app's own hostnames. Remove it from `APP_HOSTNAMES` / `VITE_APP_HOSTNAMES`. Changes can take a minute to apply. |
| A custom domain shows a certificate error | DocGen doesn't issue certificates. Put the domain behind a proxy that handles HTTPS and forwards the `Host` header. |
| Search results link to `localhost` | Set `PUBLIC_URL` to the backend's public address. |
| `relation "public.projects" does not exist` | The database schema hasn't been applied. See step 1. |
| "Saving AI keys isn't enabled on this server" | Set `AI_KEY_ENCRYPTION_KEY` in `backend/.env` and restart the backend. |
| "This saved key can't be decrypted" | `AI_KEY_ENCRYPTION_KEY` changed since the key was saved. Enter the key again in **Settings → AI providers**. |
| Docs page says "Document not found" | Wait for the build to finish. The project status turns **Successful** on the dashboard when it does. |
| A run stays **Queued** | No worker is running. Check the backend log for `[Worker] ... running up to N job(s)`; if `WORKER_CONCURRENCY=0`, start `npm --prefix backend run worker`. |
| The activity feed says "Retrying in 1 min" | The provider failed temporarily. The run retries on its own; the row shows the last error. |

## Project layout

| Path | Contents |
|---|---|
| `backend/server.js` | API routes |
| `backend/jobs/` | Job queue (`queue.js`), worker (`worker.js`) and what each job type does (`handlers.js`) |
| `backend/worker.js` | Standalone worker process (`npm run worker`) |
| `backend/services/generationPipeline.js` | Clone → plan → write → publish pipeline the jobs run |
| `backend/aiWriter.js`, `backend/aiEditor.js` | Architect, ghostwriter and critic prompts |
| `backend/ai/` | One client interface for Anthropic, OpenAI, Gemini and OpenAI-compatible providers |
| `backend/services/aiCredentials.js` | Encrypted storage and testing of users' own AI keys; `getUserLLM()` for generation |
| `backend/ai/sourceDigest.js` | Fits large repos into the prompt budget, most important files first |
| `backend/mdx/components.js` | The docs components pages may use, shared by the prompts, the compiler and the viewer |
| `backend/mdx/safeMdx.js` | Compiles a page into a code-free render tree |
| `frontend/src/components/mdx/SafeMdxRenderer.jsx` | Draws a compiled page in the browser |
| `backend/config.js` | All environment configuration |
| `backend/lib/safeFetch.js` | `fetch` that only connects to public addresses (custom AI endpoints, API playground) |
| `backend/services/webhookSecrets.js` | Per-project GitHub webhook secrets |
| `backend/quality/factCheck.js` | Checks generated pages against the repository |
| `backend/openapi/` | Builds the API reference from an OpenAPI/Swagger spec |
| `build/build.js` | Static build (`site.json`), search index and Ask AI section index |
| `lib/siteManifest.js` | Sidebar groups, tabs and reading order |
| `backend/seo/`, `backend/routes/site.js` | Server-rendered docs pages, sitemaps, `llms.txt`, `robots.txt`, custom-domain routing |
| `backend/services/customDomains.js` | Custom domains and their DNS verification |
| `frontend/src/pages/DocEngine.jsx` | Public docs viewer |
| `supabase/migrations/` | Database schema, RLS policies, SQL functions |

## License

No license has been chosen yet. Until one is added, all rights are reserved by the author.
