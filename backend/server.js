const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const cookieParser = require('cookie-parser');
const csrf         = require('csurf');
const helmet = require('helmet');
const crypto = require('crypto');
const cloneRepo = require("./gitServices");
const scanCodeFiles = require("./codeScanner");
const { generateDocs, generatePage, generateArchitectBlueprint } = require("./aiWriter");
const analyzeRepo = require("./repoAnalyzer");
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const askAI = require("./ai.service");
const validator = require('validator');

const app = express();
const publicRoutes = require('./routes/public');
const mcpRoutes = require('./routes/mcp');
const { generateSkill, getSkillIndex } = require('../lib/generateSkill');

app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true 
}));

// --- WEBHOOK RAW BODY EXCEPTION ---
app.use((req, res, next) => {
  if (req.path === '/api/billing/webhook') {
    // Keep raw body for Razorpay signature verification
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
        const webhookSecret    = process.env.RAZORPAY_WEBHOOK_SECRET;

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
      connectSrc:  ["'self'", 'https://*.supabase.co', 'https://generativelanguage.googleapis.com'],
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

app.use("/api/static", express.static(path.join(__dirname, "../dist")));

// --- NEW (PHASE 3): DYNAMIC DOCS FETCHING ROUTE ---
app.get('/api/docs/:tenant/:version/*docPath', (req, res) => {
    // req.params.docPath holds the exact file path dynamically matched
    let docPath = req.params.docPath;

    // AI Agents might request .md files directly, so strip the extension if present to match our .mdx files
    if (docPath.endsWith('.md')) {
        docPath = docPath.slice(0, -3);
    }
    
    // Construct the absolute path. We enforce the .mdx extension here!
    const absolutePath = path.resolve(__dirname, '..', 'dist', req.params.tenant, req.params.version, `${docPath}.mdx`);

    if (fs.existsSync(absolutePath)) {
        res.type('text/markdown').sendFile(absolutePath);
    } else {
        res.status(404).json({
            error: "Document Not Found",
            message: `The documentation page '${docPath}' could not be found. Check docs.json for typos.`,
            requestedPath: docPath
        });
    }
});

app.use('/api/public', publicRoutes);
app.use('/api/mcp', mcpRoutes);

// --- SECURITY: LAYER 3 XSS PREVENTION (Input Sanitization) ---
function sanitizeString(input, maxLength = 100) {
    if (!input || typeof input !== 'string') return '';
    return validator.escape(input.trim()).slice(0, maxLength);
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
            .select('id')
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });

        const { data: member } = await supabase
            .from('project_members')
            .select('role')
            .eq('project_id', project.id)
            .eq('user_id', req.user.id)
            .single();

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
    .from('users').select('plan, plan_status').eq('id', req.user.id).single();

  // If a Pro user's payment fails (halted), we treat them as a Free user
  const plan   = user.plan_status === 'active' ? user.plan : 'free';
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const month  = new Date().toISOString().slice(0, 7); // Gets 'YYYY-MM'

  const { data: usage } = await supabase
    .from('usage_tracking').select('generations')
    .eq('user_id', req.user.id).eq('month', month).single();

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
    .from('users').select('plan').eq('id', req.user.id).single();
  const limits = PLAN_LIMITS[user?.plan || 'free'];

  if (limits.maxProjects === Infinity) return next();

  const { count } = await supabase.from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', req.user.id);

  if (count >= limits.maxProjects) {
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
  try {
    const user = req.user;

    // 1. Check if user already has an active subscription
    const { data: userData } = await supabase
      .from('users')
      .select('razorpay_customer_id, plan, email, full_name')
      .eq('id', user.id)
      .single();

    if (userData.plan === 'pro') {
      return res.status(400).json({ error: 'Already on Pro plan' });
    }

    // 2. Create the Razorpay Subscription
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PRO_PLAN_ID,
      total_count: 120, // 120 months = 10 years (effectively unlimited)
      quantity: 1,
      customer_notify: 1, // Razorpay sends payment reminder emails automatically
      notes: {
        supabase_user_id: user.id,
        user_email: userData.email,
      },
    });

    // 3. Save the subscription ID to your Supabase database immediately
    await supabase.from('users')
      .update({ razorpay_subscription_id: subscription.id })
      .eq('id', user.id);

    // 4. Return the subscription ID so the frontend can open the Razorpay popup
    res.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Webhook stays public so GitHub can ping it without a login token
app.post("/api/webhook", async (req, res) => {
    const payload = req.body;

    if (req.headers['x-github-event'] === 'ping') {
        console.log("👋 [Webhook] Received GitHub ping. The tunnel is perfectly connected!");
        return res.status(200).json({ message: "Pong! Connection successful." });
    }

    if (!payload.commits || !payload.repository) {
        return res.status(400).json({ message: "Not a valid push event." })
    }

    const repoUrl = payload.repository.clone_url;
    const projectName = payload.repository.name;
    const tenantName = payload.repository.owner.login;

    let changedFiles = [];
    for (const commit of payload.commits) {
        if (commit.added) changedFiles.push(...commit.added);
        if(commit.modified) changedFiles.push(...commit.modified);
    }

    changedFiles = [...new Set(changedFiles)];

    const vaildExtensions = [".js", ".ts", ".py", ".go"];
    const filesToProcess = changedFiles.filter(file => {
        const ext = path.extname(file);
        return vaildExtensions.includes(ext);
    });

    if (filesToProcess.length === 0) {
        console.log("[webhook] No relevant code files changed. Skipping AI generation.");
        return res.status(200).json({ message: "No relevant files changed." });
    }

    try {
        console.log(`\n [Webhook] Detected changes in ${filesToProcess.length} files. Starting targeted update...`);

        const downloadedFolderPath = await cloneRepo(repoUrl, projectName);

        const targetDir = path.join(__dirname, "../docs", tenantName, projectName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        let generatedCount = 0;
        let updatedRoutes = []; // <-- NEW: Array to hold the changed files

        for (const relativeFilePath of filesToProcess) {
            const fullPath = path.join(downloadedFolderPath, relativeFilePath);

            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, "utf-8");
                const fileObj = { path: fullPath, code: content };
                
                const codeMap = analyzeRepo(downloadedFolderPath);
                const markdownOutput = await generateDocs(fileObj, codeMap);

                if (markdownOutput) {
                   const parsedPath = path.parse(relativeFilePath);
                   const nestedTargetDir = path.join(targetDir, parsedPath.dir);
                   
                   if (!fs.existsSync(nestedTargetDir)) {
                    fs.mkdirSync(nestedTargetDir, { recursive: true });
                   }

                   const mdFilePath = path.join(nestedTargetDir, `${parsedPath.name}.mdx`);
                   fs.writeFileSync(mdFilePath, markdownOutput);

                   // --- NEW: Format the exact route build.js expects ---
                   const routeString = `${tenantName}/${projectName}/${parsedPath.dir ? parsedPath.dir + '/' : ''}${parsedPath.name}`.replace(/\\/g, "/");
                   updatedRoutes.push(routeString);

                   console.log(`[Webhook] Updated AI Doc: ${mdFilePath}`);
                   generatedCount++;
                }
            }
        }

        console.log("[webhook] Waking up the factory Worker...");
        
        // Respond IMMEDIATELY to prevent GitHub webhook timeout
        res.status(200).json({ message: `Successfully updated ${generatedCount} files. Build running in background.` });

        const buildScriptPath = path.join(__dirname, "../build/build.js");

        // --- UPDATED: Pass the array of changed routes to the worker! ---
        const buildProcess = spawn("node", [buildScriptPath, "--webhook", ...updatedRoutes]);
        buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
        buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));

        buildProcess.on("close", (code) => {
            if (code !== 0) {
                console.error("Webhook Build failed with code:", code);
            } else {
                console.log("Targeted webhook update complete!");
            }
        });

    } catch (error) {
        console.error("Webhook Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process webhooks." });
        }
    }
});

// NEW: Require Admin or Editor to generate docs from GitHub
app.post("/api/github", csrfProtection, requireAuth, requireRole('admin', 'editor'), checkProjectLimit, checkGenerationLimit, async (req, res) => {
    const repoUrl = req.body.repoUrl; 
    const projectName = sanitizeString(req.body.projectName, 64);
    const tenantName  = sanitizeString(req.body.tenantName, 64);

    if (!repoUrl || !projectName || !tenantName) {
        return res.status(400).json({ error: "Missing repoUrl, projectName, or tenantName" });
    }

    try {
        await supabase
            .from('projects')
            .update({ status: 'running' })
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName);

        console.log(`\n [GitHub API] Starting pipeline for ${repoUrl}...`);
        const downloadedFolderPath = await cloneRepo(repoUrl, projectName);

        console.log(`[GitHub API] Analyzing repository architecture...`);
        const codeMap = analyzeRepo(downloadedFolderPath);
        console.log(`[GitHub API] Code Map generated successfully.`);

        // NEW: Expanded scanner returns both code files AND context files
        const { codeFiles: foundFiles, contextFiles } = scanCodeFiles(downloadedFolderPath);
        console.log(`[GitHub API] Inspector found ${foundFiles.length} code files + ${contextFiles.length} context files.`);

        if (foundFiles.length === 0 && contextFiles.length === 0) {
            await supabase
                .from('projects')
                .update({ status: 'failed' })
                .eq('tenant_name', tenantName)
                .eq('project_name', projectName);
            return res.status(404).json({ error: "No valid code files found in this repository." });
        }

        const targetDir = path.join(__dirname, "../docs", tenantName, projectName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // ═══════════════════════════════════════════════════════════
        // PHASE 1: SUPER-ARCHITECT — Design the entire doc site
        // ═══════════════════════════════════════════════════════════
        console.log(`\n[GitHub API] 🏗️  Triggering Super-Architect Phase...`);
        const blueprint = await generateArchitectBlueprint(foundFiles, contextFiles, projectName);

        // Build the docs.json from the Architect's page plan
        const docsJsonPath = path.join(targetDir, "docs.json");
        let siteConfig = {};

        // Non-Destructive Merge: preserve existing user branding
        if (fs.existsSync(docsJsonPath)) {
            try {
                siteConfig = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
                console.log(`[GitHub API] Found existing config. Preserving user branding.`);
            } catch (e) {
                console.log(`[GitHub API] Failed to parse existing config, creating fresh.`);
            }
        } else {
            console.log(`[GitHub API] Creating fresh docs.json template.`);
            siteConfig = {
                "$schema": "https://mintlify.com/docs.json",
                "name": blueprint.projectName || projectName.charAt(0).toUpperCase() + projectName.slice(1),
                "logo": { "light": "/logo/light.svg", "dark": "/logo/dark.svg" },
                "theme": "mint",
                "colors": { "primary": "#3b82f6", "light": "#ffffff", "dark": "#000000" }
            };
        }

        // Convert the Architect's page plan into Mintlify navigation format
        const groupMap = {};
        for (const page of blueprint.pages) {
            if (!groupMap[page.group]) groupMap[page.group] = [];
            groupMap[page.group].push(page.slug);
        }
        siteConfig.navigation = Object.entries(groupMap).map(([group, pages]) => ({
            group,
            pages
        }));

        fs.writeFileSync(docsJsonPath, JSON.stringify(siteConfig, null, 2));
        console.log(`[GitHub API] ✅ Architect Blueprint saved with ${blueprint.pages.length} pages.`);

        // ═══════════════════════════════════════════════════════════
        // PHASE 2: GHOSTWRITER — Write each page from the plan
        // ═══════════════════════════════════════════════════════════
        let generatedCount = 0;

        for (const pagePlan of blueprint.pages) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Rate limiting

            const markdownOutput = await generatePage(pagePlan, foundFiles, contextFiles, blueprint);

            if (markdownOutput) {
                const mdFilePath = path.join(targetDir, `${pagePlan.slug}.mdx`);
                fs.writeFileSync(mdFilePath, markdownOutput);
                console.log(`📄 Saved: ${pagePlan.title} → ${mdFilePath}`);
                generatedCount++;
            }
        }

        console.log("[GitHub API] Waking up the Factory Worker (build.js)...");

        // Increment Generation Count
        await supabase.rpc('increment_usage', {
            p_user_id: req.user.id,
            p_month: new Date().toISOString().slice(0, 7),
            p_field: 'generations'
        });
        
        res.json({
            message: "GitHub Repository successfully converted into documentation! Build compiling in background.",
            fileProcessed: generatedCount,
            tenant: tenantName,
            version: projectName
        });

        const buildScriptPath = path.join(__dirname, "../build/build.js");
        const buildProcess = spawn("node", [buildScriptPath, "--scope", `${tenantName}/${projectName}`]);

        buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
        buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));

        buildProcess.on("close", async (code) => {
            if (code !== 0) {
                console.error("Factory Build failed with code:", code);
                await supabase
                    .from('projects')
                    .update({ status: 'failed' })
                    .eq('tenant_name', tenantName)
                    .eq('project_name', projectName);
            } else {
                console.log("Factory Worker finished successfully!");
                await supabase
                    .from('projects')
                    .update({ status: 'successful' })
                    .eq('tenant_name', tenantName)
                    .eq('project_name', projectName);
            }
        });

    } catch (error) { 
        console.error("GitHub API Error", error);
        await supabase
            .from('projects')
            .update({ status: 'failed' })
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName);
            
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process the GitHub repository." });
        }
    }
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
    const tenant = sanitizeString(req.body.tenant, 64);
    const version = sanitizeString(req.body.version, 64);
    
    // We now accept 'navigation' from the frontend!
    const { primaryColor, logoUrl, fontFamily, darkMode, navigation } = req.body;

    const configPath = path.join(__dirname, '../docs', tenant, version, 'docgen.json');
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

    // --- UPDATED: Pass the --scope argument to the worker! ---
    const buildScriptPath = path.join(__dirname, '../build/build.js');
    const targetScope = `${tenant}/${version}`;
    
    console.log(`[Settings] Waking up worker for specific scope: ${targetScope}`);
    const buildProcess = spawn("node", [buildScriptPath, "--scope", targetScope]);
    
    buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
    buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));
});

// NEW: Require Admin to delete projects
app.delete('/api/projects/:tenant/:version', csrfProtection, requireAuth, requireRole('admin'), async (req, res) => {
    const { tenant, version } = req.params;

    const { error: supaErr } = await supabase
        .from('doc_vectors')
        .delete()
        .eq('tenant', tenant)
        .eq('version', version);
        
    if (supaErr) return res.status(500).json({ error: 'Failed to delete vectors' });

    const docsDir = path.join(__dirname, '../docs', tenant, version);
    const distDir = path.join(__dirname, '../dist', tenant, version);

    if (fs.existsSync(docsDir)) fs.rmSync(docsDir, { recursive: true, force: true });
    if (fs.existsSync(distDir)) fs.rmSync(distDir, { recursive: true, force: true });

    res.json({ message: 'Project deleted successfully' });
});

// NEW: Require Admin or Editor to save a doc file manually
app.post("/api/docs", csrfProtection, requireAuth, requireRole('admin', 'editor'), (req, res) => {
    const tenant = sanitizeString(req.body.tenant, 64);
    const version = sanitizeString(req.body.version, 64);
    const fileName = sanitizeString(req.body.fileName, 100);
    const content = req.body.content; 

    if (!tenant || !version || !fileName || !content) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const targetDir = path.join(__dirname, "../docs", tenant,version);

    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, `${fileName}.md`);

    try {
        fs.writeFileSync(filePath, content);
        console.log(`Saved new document: ${filePath}`);

        res.json({
            message: "Document saved! Engine is rebuilding in background.",
            tenant,
            version,
            fileName
        });

        const buildScriptPath = path.join(__dirname, "../build/build.js");
        const targetRoute = `${tenant}/${version}/${fileName}`;

        const buildProcess = spawn("node", [buildScriptPath, targetRoute]);

        buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
        buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));
        
        buildProcess.on("close", (code) => {
             if (code !== 0) {
                 console.error(`Build failed for ${fileName} with code ${code}`);
             } else {
                 console.log(`Engine successfully rebuilt for ${fileName}!`);
             }
        });

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

app.post("/api/ask", async (req, res) => {
    try {
        const { question, tenant, version } = req.body;

        if (!question || !tenant || !version) {
            return res.status(400).json({ error: "Missing question, tenant, or version." });
        }

        console.log(`\n Calculating math vector for question: "${question}"`);

        const embedResult = await embeddingModel.embedContent(question);
        const questionVector = embedResult.embedding.values;

        const { data: topChunks, error: supabaseError } = await supabase.rpc('match_vectors', {
            query_embedding: questionVector,
            match_threshold: 0.1,
            match_count: 3,
            search_tenant: tenant,
            search_version: version
        });

        if (supabaseError) {
            console.error("Supabase Search Error:", supabaseError);
            return res.status(500).json({ error: "Database search failed."});
        }

        console.log("Top 3 Cloud Match Scores:");
        topChunks.forEach((c, i) => console.log(` ${ i + 1}: Score ${c.similarity.toFixed(3)} -> ${c.text.substring(0,40)}...`));

        const contextString = topChunks.map(c => c.text).join("\n\n");

        console.log("Sending context to Gemini...");
        const answer = await askAI(question, contextString);

        res.json({ answer: answer });

    } catch (error) {
        console.error("Ask API Error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
})

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

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Auto-regenerate skill.md on every server start
    try {
        generateSkill();
        console.log('[Skill] skill.md auto-generated successfully on startup.');
    } catch (err) {
        console.error('[Skill] Failed to auto-generate skill.md:', err.message);
    }
});