// Load and validate configuration before anything else touches process.env.
const { config, assertRequiredConfig, logOptionalFeatures } = require("./config");
try {
    assertRequiredConfig();
} catch (err) {
    console.error(`\n[Config] ${err.message}\n`);
    process.exit(1);
}

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cookieParser = require('cookie-parser');
const csrf         = require('csurf');
const helmet = require('helmet');
const crypto = require('crypto');
const { buildProject, filterChangedFiles } = require("./services/generationPipeline");
const { DOCS_DIR, DIST_DIR, isSafeSegment, parseGithubRepoUrl } = require("./lib/paths");
const supabase = require("./lib/supabase");
const { getUserLLM, getPreviewLLM } = require("./services/aiCredentials");
const { createRateLimiter } = require("./lib/rateLimit");
const { enqueueJob, enqueueWebhookUpdate, getJob, cancelJob } = require("./jobs/queue");
const { createWorker } = require("./jobs/worker");
const { describeAiError } = require("./ai/httpErrors");
const { compileSafeMdx } = require("./mdx/safeMdx");

// Billing is optional: Razorpay is only set up when its keys are present.
let razorpay = null;
if (config.razorpay.enabled) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret,
    });
}

const askAI = require("./ai.service");

const app = express();
const publicRoutes = require('./routes/public');
const mcpRoutes = require('./routes/mcp');
const { createAiRouter } = require('./routes/ai');
const { generateSkill, getSkillIndex } = require('../lib/generateSkill');

app.use(cors({
    origin: config.frontendUrl,
    credentials: true 
}));

// --- WEBHOOK RAW BODY EXCEPTION ---
app.use((req, res, next) => {
  if (req.path === '/api/billing/webhook' || req.path === '/api/webhook') {
    // Keep the raw body for Razorpay and GitHub signature verification
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    // For all other routes, parse JSON normally
    express.json()(req, res, next);
  }
});

// --- RAZORPAY WEBHOOK HANDLER ---
app.post('/api/billing/webhook', async (req, res) => {
    try {
        // 1. Verify the signature to ensure it actually came from Razorpay
        const webhookSignature = req.headers['x-razorpay-signature'];
        const webhookSecret    = config.razorpay.webhookSecret;

        if (!webhookSecret) {
            return res.status(503).json({ error: 'Billing webhook is not configured.' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(req.body) // This works because of the raw body exception we added!
            .digest('hex');

        if (webhookSignature !== expectedSignature) {
            console.error('Invalid Razorpay webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // 2. Parse the verified event
        const event = JSON.parse(req.body);
        const entity = event.payload?.subscription?.entity;

        // Helper function to find which user this payment belongs to
        const getUserBySubId = async (subscriptionId) => {
            const { data } = await supabase
                .from('users')
                .select('id')
                .eq('razorpay_subscription_id', subscriptionId)
                .single();
            return data?.id;
        };

        const userId = await getUserBySubId(entity?.id);
        if (!userId) return res.status(200).json({ received: true });

        // 3. Handle the specific billing events
        switch (event.event) {
            case 'subscription.activated':
            case 'subscription.charged': {
                // Payment succeeded! Upgrade them to Pro.
                await supabase.from('users').update({
                    plan: 'pro',
                    plan_status: 'active',
                    plan_current_end: new Date(entity.current_end * 1000).toISOString(),
                }).eq('id', userId);
                console.log(`User ${userId} upgraded/renewed to Pro!`);
                break;
            }
            case 'subscription.cancelled': {
                // User cancelled, but keep Pro active until the end of the month
                await supabase.from('users').update({
                    plan_status: 'cancelled',
                }).eq('id', userId);
                console.log(`User ${userId} cancelled subscription.`);
                break;
            }
            case 'subscription.completed': {
                // The billing period ended after they cancelled. Downgrade to Free.
                await supabase.from('users').update({
                    plan: 'free',
                    plan_status: 'active',
                    razorpay_subscription_id: null,
                    plan_current_end: null,
                }).eq('id', userId);
                console.log(`User ${userId} downgraded to free.`);
                break;
            }
            case 'subscription.halted': {
                // Payment failed multiple times. Lock the account.
                await supabase.from('users').update({
                    plan_status: 'halted',
                }).eq('id', userId);
                console.log(`Subscription halted for user ${userId} due to payment failure.`);
                break;
            }
        }

        // Always respond 200 OK so Razorpay knows we got the message
        res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// --- SECURITY: Force HTTPS in Production ---
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// --- SECURITY: LAYER 2 XSS PREVENTION (CSP) ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-eval'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'", 'https://*.supabase.co'],
      frameSrc:    ["'self'"]
    },
  },
}));

// --- SECURITY: Cookie Parser & CSRF Setup ---
app.use(cookieParser());

const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure:   process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    }
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

app.use("/api/static", express.static(DIST_DIR));

// --- DOCS PAGES ---
// Resolves /:tenant/:version/<page path> to a file in dist/, or answers 400/404 itself.
function resolveDistPage(req, res, extension) {
    const { tenant, version } = req.params;

    // Express 5 gives the wildcard as an array of path segments, e.g. ['guides', 'setup']
    const segments = [].concat(req.params.docPath);

    // AI Agents might request .md/.mdx files directly, so strip the extension to match our .mdx files
    const last = segments.length - 1;
    segments[last] = segments[last].replace(/\.mdx?$/, '');
    const docPath = segments.join('/');

    // Every segment must be a plain name, so the path can't escape dist/
    if (![tenant, version, ...segments].every(isSafeSegment)) {
        res.status(400).json({ error: "Invalid document path.", requestedPath: docPath });
        return null;
    }

    const absolutePath = path.join(DIST_DIR, tenant, version, ...segments) + extension;
    if (!fs.existsSync(absolutePath)) {
        res.status(404).json({
            error: "Document Not Found",
            message: `The documentation page '${docPath}' could not be found. Check docs.json for typos.`,
            requestedPath: docPath
        });
        return null;
    }
    return absolutePath;
}

// Raw MDX, for AI agents and llms.txt readers.
app.get('/api/docs/:tenant/:version/*docPath', (req, res) => {
    const file = resolveDistPage(req, res, '.mdx');
    if (file) res.type('text/markdown').sendFile(file);
});

// The compiled, code-free page the docs viewer renders (see backend/mdx/safeMdx.js).
app.get('/api/page/:tenant/:version/*docPath', (req, res) => {
    // Sites built before pages were pre-compiled only have the .mdx: compile it now and
    // save the result, so they keep working without a rebuild.
    const mdxFile = resolveDistPage(req, res, '.mdx');
    if (!mdxFile) return;
    const pageFile = mdxFile.replace(/\.mdx$/, '.page.json');
    if (!fs.existsSync(pageFile)) {
        const source = fs.readFileSync(mdxFile, 'utf8');
        const compiled = compileSafeMdx(source);
        const title = (source.match(/^#\s+(.+)$/m) || [])[1] || path.basename(mdxFile, '.mdx');
        fs.writeFileSync(pageFile, JSON.stringify(compiled.ok ? { title, tree: compiled.tree } : { title, error: compiled.error }));
    }
    res.type('application/json').sendFile(pageFile);
});

app.use('/api/public', publicRoutes);
app.use('/api/mcp', mcpRoutes);
// Bring-your-own AI keys (requireAuth is a hoisted function declaration below)
app.use('/api/ai', createAiRouter({ requireAuth, csrfProtection }));

// --- SECURITY: Input validation for names that become folder names ---
// Returns the trimmed name if it is a safe path segment, otherwise ''.
function readName(input) {
    if (typeof input !== 'string') return '';
    const name = input.trim();
    return isSafeSegment(name) ? name : '';
}

// --- SECURITY: RBAC MIDDLEWARE (Authentication & Roles) ---
async function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.slice(7);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
}

function requireRole(...allowedRoles) {
    return async (req, res, next) => {
        // Find tenant and project name (handles both body and params)
        const tenantName = req.body.tenantName || req.body.tenant || req.params.tenant;
        const projectName = req.body.projectName || req.body.version || req.params.version;

        if (!tenantName || !projectName) {
            return res.status(400).json({ error: 'Missing project details for role check' });
        }

        const { data: project } = await supabase
            .from('projects')
            .select('id, user_id')
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName)
            .maybeSingle();

        if (!project) return res.status(404).json({ error: 'Project not found' });

        // The project owner is always an admin, even if no membership row exists yet.
        if (project.user_id === req.user.id) {
            req.userRole = 'admin';
            return next();
        }

        const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', project.id)
            .eq('user_id', req.user.id)
            .maybeSingle();

        if (!member || !allowedRoles.includes(member.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        req.userRole = member.role;
        next();
    }
}

// --- PLAN LIMITS & USAGE MIDDLEWARE ---
const PLAN_LIMITS = {
  free: {
    maxProjects:     3,
    maxGenerations:  20,
    maxTeamMembers:  1,
    maxAiQueries:    10,
  },
  pro: {
    maxProjects:     Infinity,
    maxGenerations:  Infinity,
    maxTeamMembers:  5,
    maxAiQueries:    Infinity,
  },
  enterprise: {
    maxProjects:     Infinity,
    maxGenerations:  Infinity,
    maxTeamMembers:  Infinity,
    maxAiQueries:    Infinity,
  },
};

async function checkGenerationLimit(req, res, next) {
  const { data: user } = await supabase
    .from('users').select('plan, plan_status').eq('id', req.user.id).maybeSingle();

  // If a Pro user's payment fails (halted), we treat them as a Free user
  const plan   = user?.plan_status === 'active' ? user.plan : 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const month  = new Date().toISOString().slice(0, 7); // Gets 'YYYY-MM'

  const { data: usage } = await supabase
    .from('usage_tracking').select('generations')
    .eq('user_id', req.user.id).eq('month', month).maybeSingle();

  if ((usage?.generations || 0) >= limits.maxGenerations) {
    return res.status(403).json({
      error:           'Generation limit reached. Please upgrade to Pro.',
      used:            usage?.generations || 0,
      limit:           limits.maxGenerations,
      upgradeRequired: plan === 'free',
    });
  }
  
  req.userPlan = plan;
  next();
}

async function checkProjectLimit(req, res, next) {
  const { data: user } = await supabase
    .from('users').select('plan').eq('id', req.user.id).maybeSingle();
  const limits = PLAN_LIMITS[user?.plan] || PLAN_LIMITS.free;

  if (limits.maxProjects === Infinity) return next();

  const { count } = await supabase.from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  // The dashboard creates the project row before calling /api/github,
  // so a project that already exists for this user is included in the count.
  const { data: current } = await supabase.from('projects')
    .select('id')
    .eq('user_id', req.user.id)
    .eq('tenant_name', req.body.tenantName || '')
    .eq('project_name', req.body.projectName || '')
    .maybeSingle();
  const overLimit = current ? count > limits.maxProjects : count >= limits.maxProjects;

  if (overLimit) {
    return res.status(403).json({
      error:           'Project limit reached. Please upgrade to Pro.',
      limit:           limits.maxProjects,
      upgradeRequired: true,
    });
  }
  next();
}

app.get("/", (req, res) => {
    res.send("Docs API is running smoothly!");
});

// --- RAZORPAY BILLING ROUTES ---

app.post('/api/billing/create-subscription', csrfProtection, requireAuth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({ error: 'Billing is not enabled on this server.' });
  }

  try {
    const user = req.user;

    // 1. Check if user already has an active subscription
    const { data: userData } = await supabase
      .from('users')
      .select('razorpay_customer_id, plan, email, full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.plan === 'pro') {
      return res.status(400).json({ error: 'Already on Pro plan' });
    }

    // 2. Create the Razorpay Subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: config.razorpay.proPlanId,
      total_count: 120, // 120 months = 10 years (effectively unlimited)
      quantity: 1,
      customer_notify: 1, // Razorpay sends payment reminder emails automatically
      notes: {
        supabase_user_id: user.id,
        user_email: userData?.email || user.email,
      },
    });

    // 3. Save the subscription ID to your Supabase database immediately
    await supabase.from('users')
      .update({ razorpay_subscription_id: subscription.id })
      .eq('id', user.id);

    // 4. Return the subscription ID so the frontend can open the Razorpay popup
    res.json({
      subscriptionId: subscription.id,
      keyId: config.razorpay.keyId,
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// GitHub push webhook: regenerates docs for changed files with the project owner's AI key.
// No login token, so every delivery must carry GitHub's signature for GITHUB_WEBHOOK_SECRET;
// otherwise anyone could trigger generation and spend the owner's AI credits.
function hasValidGithubSignature(req) {
    const signature = String(req.headers['x-hub-signature-256'] || '');
    const expected = 'sha256=' + crypto.createHmac('sha256', config.github.webhookSecret).update(req.body).digest('hex');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post("/api/webhook", async (req, res) => {
    if (!config.github.webhookSecret) {
        return res.status(503).json({ message: "GitHub webhook is not configured on this server." });
    }
    if (!Buffer.isBuffer(req.body) || !hasValidGithubSignature(req)) {
        return res.status(401).json({ message: "Invalid or missing GitHub signature." });
    }

    let payload;
    try {
        payload = JSON.parse(req.body.toString('utf8'));
    } catch {
        return res.status(400).json({ message: "Invalid JSON payload." });
    }

    if (req.headers['x-github-event'] === 'ping') {
        console.log("👋 [Webhook] Received GitHub ping. The tunnel is perfectly connected!");
        return res.status(200).json({ message: "Pong! Connection successful." });
    }

    if (!payload.commits || !payload.repository) {
        return res.status(400).json({ message: "Not a valid push event." })
    }

    const repoUrl = payload.repository.clone_url;
    const projectName = readName(payload.repository.name);
    const tenantName = readName(payload.repository.owner?.login);

    if (!projectName || !tenantName) {
        return res.status(400).json({ message: "Invalid repository name." });
    }

    const changedFiles = [];
    for (const commit of payload.commits) {
        if (Array.isArray(commit.added)) changedFiles.push(...commit.added);
        if (Array.isArray(commit.modified)) changedFiles.push(...commit.modified);
    }
    const filesToProcess = filterChangedFiles(changedFiles);

    if (filesToProcess.length === 0) {
        console.log("[webhook] No relevant code files changed. Skipping AI generation.");
        return res.status(200).json({ message: "No relevant files changed." });
    }

    // Updates are written with the project owner's own AI key.
    const { data: project } = await supabase
        .from('projects')
        .select('id, user_id')
        .eq('tenant_name', tenantName)
        .eq('project_name', projectName)
        .maybeSingle();
    if (!project?.user_id) {
        return res.status(200).json({ message: "No project owner to write docs for. Skipping." });
    }

    let llm;
    try {
        llm = await getUserLLM(project.user_id);
    } catch (error) {
        const ai = describeAiError(error);
        if (!ai) throw error;
        console.log(`[Webhook] Skipping ${tenantName}/${projectName}: ${ai.message}`);
        return res.status(200).json({ message: `Skipped: ${ai.message}` });
    }

    // GitHub gives up after 10 seconds, so queue the update and answer at once.
    const { jobId, merged, skipped } = await enqueueWebhookUpdate({
        projectId: project.id,
        payload: { repoUrl, tenantName, projectName, userId: project.user_id, files: filesToProcess },
        provider: llm.provider,
        model: llm.writerModel,
    });
    const message = skipped
        ? "A full regeneration is already queued; it will include these changes."
        : merged
            ? `Added ${filesToProcess.length} changed files to the update already queued.`
            : `Queued a docs update for ${filesToProcess.length} changed files.`;
    console.log(`[Webhook] ${tenantName}/${projectName}: ${message}`);
    res.status(202).json({ message, jobId });
});

// NEW: Require Admin or Editor to generate docs from GitHub
app.post("/api/github", csrfProtection, requireAuth, requireRole('admin', 'editor'), checkProjectLimit, checkGenerationLimit, async (req, res) => {
    const repoUrl = req.body.repoUrl; 
    const projectName = readName(req.body.projectName);
    const tenantName  = readName(req.body.tenantName);

    if (!repoUrl || !projectName || !tenantName) {
        return res.status(400).json({ error: "Missing or invalid repoUrl, projectName, or tenantName" });
    }

    if (!parseGithubRepoUrl(repoUrl)) {
        return res.status(400).json({ error: "Repository URL must look like https://github.com/<owner>/<repo>." });
    }

    const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_name', tenantName)
        .eq('project_name', projectName)
        .maybeSingle();
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Docs are written with the AI key of whoever starts the run. Check it now so a missing
    // key is reported straight away instead of as a failed job.
    let llm;
    try {
        llm = await getUserLLM(req.user.id);
    } catch (error) {
        const ai = describeAiError(error);
        if (!ai) throw error;
        await supabase.from('projects').update({ status: 'failed' }).eq('id', project.id).in('status', ['pending', 'running']);
        return res.status(ai.status).json({ error: ai.message, code: ai.code });
    }

    await supabase.from('projects').update({ repo_url: repoUrl }).eq('id', project.id);
    const { jobId, duplicate } = await enqueueJob({
        projectId: project.id,
        eventType: 'generation',
        triggeredBy: 'dashboard',
        payload: { repoUrl, tenantName, projectName, userId: req.user.id },
        provider: llm.provider,
        model: llm.writerModel,
    });

    if (duplicate) {
        return res.status(409).json({ error: "A generation for this project is already waiting to start.", code: 'already_queued', jobId });
    }
    res.status(202).json({ message: "Generation queued.", jobId, tenant: tenantName, version: projectName });
});

// --- Job status and cancellation (members of the job's project) ---
async function loadJobForMember(req, res, allowedRoles) {
    const job = await getJob(req.params.id);
    if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return null;
    }
    const { data: project } = await supabase.from('projects').select('user_id').eq('id', job.project_id).maybeSingle();
    let role = project?.user_id === req.user.id ? 'admin' : null;
    if (!role) {
        const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', job.project_id)
            .eq('user_id', req.user.id)
            .maybeSingle();
        role = member?.role || null;
    }
    if (!role) {
        res.status(404).json({ error: 'Job not found' });
        return null;
    }
    if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return null;
    }
    return job;
}

app.get('/api/jobs/:id', requireAuth, async (req, res) => {
    const job = await loadJobForMember(req, res, ['admin', 'editor', 'viewer']);
    if (job) res.json({ job });
});

app.post('/api/jobs/:id/cancel', csrfProtection, requireAuth, async (req, res) => {
    const job = await loadJobForMember(req, res, ['admin', 'editor']);
    if (!job) return;
    if (!['queued', 'running'].includes(job.status)) {
        return res.status(409).json({ error: `This job has already ${job.status === 'successful' ? 'finished' : job.status === 'cancelled' ? 'been cancelled' : 'failed'}.`, job });
    }
    res.json({ job: await cancelJob(job.id) });
});

// --- NEW: Two-Way GitHub Sync Route ---
app.post("/api/github/save-config", csrfProtection, requireAuth, async (req, res) => {
    // We expect the frontend to pass the config object and the user's GitHub provider token
    const { tenant, version, configData, githubToken } = req.body;

    if (!tenant || !version || !configData || !githubToken) {
        return res.status(400).json({ error: "Missing required sync data." });
    }

    try {
        console.log(`\n☁️ [GitHub Sync] Pushing docs.json to ${tenant}/${version}...`);

        // 1. Convert the JSON config into a Base64 string (GitHub API requires Base64)
        const contentEncoded = Buffer.from(JSON.stringify(configData, null, 2)).toString("base64");
        const path = "docs.json";
        const repoUrl = `https://api.github.com/repos/${tenant}/${version}/contents/${path}`;

        const headers = {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DocGen-Platform"
        };

        // 2. Fetch the existing file first to get its 'sha' (GitHub requires this to update an existing file)
        let sha = null;
        const getFileRes = await fetch(repoUrl, { headers });
        if (getFileRes.ok) {
            const fileData = await getFileRes.json();
            sha = fileData.sha;
        }

        // 3. Commit the file directly to the repository
        const commitBody = {
            message: "Update docs.json configuration via Dashboard",
            content: contentEncoded,
        };
        
        // If the file already existed, attach the sha to overwrite it
        if (sha) commitBody.sha = sha;

        const putRes = await fetch(repoUrl, {
            method: "PUT",
            headers,
            body: JSON.stringify(commitBody)
        });

        if (!putRes.ok) {
            const errData = await putRes.json();
            throw new Error(errData.message || "Failed to push to GitHub");
        }

        console.log(`✅ [GitHub Sync] Successfully committed docs.json!`);
        res.json({ message: "Successfully synced to GitHub!" });

    } catch (error) {
        console.error("❌ GitHub Sync Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// NEW: Require Admin to save settings
// NEW: Require Admin to save settings & navigation
app.post('/api/settings', csrfProtection, requireAuth, requireRole('admin'), async (req, res) => {
    const tenant = readName(req.body.tenant);
    const version = readName(req.body.version);

    if (!tenant || !version) {
        return res.status(400).json({ error: 'Invalid project' });
    }
    
    // We now accept 'navigation' from the frontend!
    const { primaryColor, logoUrl, fontFamily, darkMode, navigation } = req.body;

    const configPath = path.join(DOCS_DIR, tenant, version, 'docgen.json');
    const configDir  = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    // 1. Read existing config so we don't accidentally delete the user's colors!
    let existingConfig = {};
    if (fs.existsSync(configPath)) {
        try { existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } 
        catch (e) { console.error("Error reading existing config:", e); }
    }

    // 2. Merge the old config with the new incoming data
    const config = {
        ...existingConfig,
        name: version,
        theme: { 
            primaryColor: primaryColor || existingConfig.theme?.primaryColor,
            logoUrl: logoUrl || existingConfig.theme?.logoUrl,
            fontFamily: fontFamily || existingConfig.theme?.fontFamily,
            darkMode: darkMode !== undefined ? darkMode : existingConfig.theme?.darkMode 
        },
        // Save the new sidebar order!
        navigation: navigation || existingConfig.navigation || [], 
        updatedAt: new Date().toISOString()
    };

   fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    res.json({ message: 'Settings saved. Rebuilding site in background...' });

    console.log(`[Settings] Waking up worker for specific scope: ${tenant}/${version}`);
    buildProject(tenant, version)
        .catch((err) => console.error("Settings rebuild failed:", err.message));
});

// NEW: Require Admin to delete projects
app.delete('/api/projects/:tenant/:version', csrfProtection, requireAuth, requireRole('admin'), async (req, res) => {
    const { tenant, version } = req.params;

    if (!isSafeSegment(tenant) || !isSafeSegment(version)) {
        return res.status(400).json({ error: 'Invalid project' });
    }

    const { error: supaErr } = await supabase
        .from('doc_chunks')
        .delete()
        .eq('tenant', tenant)
        .eq('version', version);
        
    if (supaErr) return res.status(500).json({ error: 'Failed to delete search index' });

    const docsDir = path.join(DOCS_DIR, tenant, version);
    const distDir = path.join(DIST_DIR, tenant, version);

    if (fs.existsSync(docsDir)) fs.rmSync(docsDir, { recursive: true, force: true });
    if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });

    res.json({ message: 'Project deleted successfully' });
});

// NEW: Require Admin or Editor to save a doc file manually
app.post("/api/docs", csrfProtection, requireAuth, requireRole('admin', 'editor'), (req, res) => {
    const tenant = readName(req.body.tenant);
    const version = readName(req.body.version);
    const fileName = readName(req.body.fileName);
    const content = req.body.content; 

    if (!tenant || !version || !fileName || typeof content !== 'string' || !content) {
        return res.status(400).json({ error: "Missing or invalid required fields" });
    }

    // Don't publish a page the viewer can't render.
    const compiled = compileSafeMdx(content);
    if (!compiled.ok) {
        const { message, line, column } = compiled.error;
        return res.status(400).json({ error: `This page has a syntax error${line ? ` on line ${line}` : ''}: ${message}`, line, column });
    }

    const targetDir = path.join(DOCS_DIR, tenant, version);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // The docs viewer serves .mdx files, so save with that extension.
    const filePath = path.join(targetDir, `${fileName}.mdx`);

    try {
        fs.writeFileSync(filePath, content);
        console.log(`Saved new document: ${filePath}`);

        res.json({
            message: "Document saved! Engine is rebuilding in background.",
            tenant,
            version,
            fileName
        });

        buildProject(tenant, version)
            .then(() => console.log(`Engine successfully rebuilt for ${fileName}!`))
            .catch((err) => console.error(`Build failed for ${fileName}:`, err.message));

    } catch (err) {
        console.error("Error saving file:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to save the file." });
        }
    }
});

app.post("/api/proxy", async (req, res) => {
    const { targetUrl, targetMethod, payload } = req.body;

    if (!targetUrl || !targetMethod) {
        return res.status(400).json({ error: "Missing targetUrl or targetMethod." });
    }

    try {
        console.log(`\n🔌 [Proxy] Forwarding ${targetMethod} request to: ${targetUrl}`);
        
        const fetchOptions = {
            method: targetMethod,
            headers: {
                "Content-Type": "application/json",
            }
        };

        if (payload && targetMethod !== "GET" && targetMethod !== "DELETE") {
            fetchOptions.body = JSON.stringify(payload);
        }

        const externalResponse = await fetch(targetUrl, fetchOptions);
        const data = await externalResponse.json().catch(() => ({}));

        res.status(externalResponse.status).json({
            status: externalResponse.status,
            data: data
        });

    } catch (error) {
        console.error("❌ [Proxy] Request failed:", error.message);
        res.status(500).json({ 
            error: "Failed to reach the target URL.", 
            details: error.message 
        });
    }
});

app.get("/api/domain/:customDomain", async (req, res) => {
    const { customDomain } = req.params;

    try {
        const { data, error } = await supabase
            .from('projects')
            .select('tenant_name, project_name')
            .eq('custom_domain', customDomain)
            .single();

        if (error || !data) {
            console.log(`[Domain Routing] Unrecognized domain pinged: ${customDomain}`);
            return res.status(404).json({ error: "Domain not linked to any project." });
        }

        console.log(`[Domain Routing] Matched ${customDomain} -> ${data.tenant_name}/${data.project_name}`);
        
        res.json({
            tenant: data.tenant_name,
            version: data.project_name
        });

    } catch (error) {
        console.error("[Domain Routing] Server Error:", error);
        res.status(500).json({ error: "Failed to verify domain." });
    }
});

// --- ASK AI: answers readers' questions from the docs ---
// Readers are anonymous, but every answer is paid for by the project owner's AI key,
// so requests are limited per visitor and per docs site.
const askLimitPerVisitor = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20, key: (req) => req.ip });
const askLimitPerSite = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 200, key: (req) => `${req.body?.tenant}/${req.body?.version}` });
const ASK_UNAVAILABLE = "Ask AI isn't set up for these docs yet.";

app.post("/api/ask", askLimitPerVisitor, askLimitPerSite, async (req, res) => {
    const question = typeof req.body.question === 'string' ? req.body.question.trim().slice(0, 1000) : '';
    const tenant = readName(req.body.tenant);
    const version = readName(req.body.version);

    if (!question || !tenant || !version) {
        return res.status(400).json({ error: "Missing question, tenant, or version." });
    }

    try {
        const { data: project } = await supabase
            .from('projects')
            .select('user_id')
            .eq('tenant_name', tenant)
            .eq('project_name', version)
            .maybeSingle();
        if (!project) return res.status(404).json({ error: "These docs don't exist." });

        // The owner's AI answers; unclaimed preview sites use the server's preview AI, if any.
        let llm = null;
        if (project.user_id) {
            try {
                llm = await getUserLLM(project.user_id);
            } catch (error) {
                if (!describeAiError(error)) throw error;
            }
        } else {
            llm = getPreviewLLM();
        }
        if (!llm) return res.status(503).json({ error: ASK_UNAVAILABLE });

        // Keyword search over the docs' sections.
        const { data: chunks, error: searchError } = await supabase.rpc('search_doc_chunks', {
            search_tenant: tenant,
            search_version: version,
            query: question,
            match_count: 5,
        });
        if (searchError) {
            console.error("Ask AI search error:", searchError);
            return res.status(500).json({ error: "Search failed." });
        }

        // Nothing relevant: answer without spending the owner's AI credits.
        if (!chunks || chunks.length === 0) {
            return res.json({ answer: "I'm sorry, I cannot find the answer to that in the current documentation.", sources: [] });
        }

        const contextString = chunks.map((c) => `### ${c.title}\n(Page: ${c.route})\n${c.text}`).join("\n\n");
        const answer = await askAI(question, contextString, llm);

        if (project.user_id) {
            supabase.rpc('increment_usage', { p_user_id: project.user_id, p_month: new Date().toISOString().slice(0, 7), p_field: 'ai_queries' })
                .then(({ error }) => error && console.error("Ask AI usage count failed:", error.message));
        }

        res.json({ answer, sources: chunks.map((c) => ({ title: c.title, route: c.route })) });

    } catch (error) {
        const ai = describeAiError(error);
        if (ai) {
            // Readers don't need the owner's provider details; the log keeps them.
            console.error(`Ask AI provider error for ${tenant}/${version}: ${ai.code} ${ai.providerMessage || ai.message}`);
            return res.status(502).json({ error: "Ask AI couldn't answer right now. Try again in a moment." });
        }
        console.error("Ask API Error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    // Catch CSRF token errors specifically
    if (err.code === 'EBADCSRFTOKEN') {
        console.error('🚫 CSRF Token missing or invalid for:', req.path);
        return res.status(403).json({ 
            error: 'Security token expired or invalid. Please refresh the page.' 
        });
    }
    
    // Pass any other errors down the line
    next(err);
});

// --- .WELL-KNOWN SKILL ROUTES (Public, for AI Agents) ---
app.get('/.well-known/skills/index.json', (req, res) => {
    res.json(getSkillIndex());
});

const handleSkillRequest = (req, res) => {
    const skillPath = path.resolve(__dirname, '..', '.well-known', 'skills', 'default', 'skill.md');
    if (fs.existsSync(skillPath)) {
        res.type('text/markdown').sendFile(skillPath);
    } else {
        // Generate on-the-fly if missing
        generateSkill();
        if (fs.existsSync(skillPath)) {
            res.type('text/markdown').sendFile(skillPath);
        } else {
            res.status(404).json({ error: 'skill.md not found' });
        }
    }
};

app.get('/.well-known/skills/default/skill.md', handleSkillRequest);
app.get('/skill.md', handleSkillRequest);

app.get('/llms.txt', (req, res) => {
    const llmsPath = path.resolve(__dirname, '..', '.well-known', 'llms.txt');
    if (fs.existsSync(llmsPath)) {
        res.type('text/plain').sendFile(llmsPath);
    } else {
        generateSkill();
        if (fs.existsSync(llmsPath)) {
            res.type('text/plain').sendFile(llmsPath);
        } else {
            res.status(404).json({ error: 'llms.txt not found' });
        }
    }
});

const PORT = config.port;
const worker = createWorker(config.jobs);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    logOptionalFeatures();
    if (config.jobs.concurrency > 0) worker.start();
    else console.log('[Worker] WORKER_CONCURRENCY=0: this server runs no jobs. Start `npm run worker` to process them.');

    // Auto-regenerate skill.md on every server start
    try {
        generateSkill();
        console.log('[Skill] skill.md auto-generated successfully on startup.');
    } catch (err) {
        console.error('[Skill] Failed to auto-generate skill.md:', err.message);
    }
});

// On shutdown (deploy, restart, `node --watch` reload) hand running jobs back to the queue
// so they start again right away instead of waiting to be detected as stalled.
let shuttingDown = false;
async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Server] ${signal} received: handing running jobs back to the queue.`);
    await worker.stop();
    process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
