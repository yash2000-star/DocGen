const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const cookieParser = require('cookie-parser');
const csrf         = require('csurf');
const helmet = require('helmet');

const cloneRepo = require("./gitServices");
const scanCodeFiles = require("./codeScanner");
const generateDocs = require("./aiWriter");
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

app.use(cors({
    origin: 'http://localhost:5173', 
    credentials: true 
}));
app.use(express.json());

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
        sameSite: 'strict',
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

    const vaildExtensions = [".js", ".ts", ".py", "go"];
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
                    console.log(`[Webhook] Updated AI Doc: ${mdFilePath}`);
                    generatedCount++;
                }
            }
        }

        console.log("[webhook] Waking up the factory Worker...");
        
        // Respond IMMEDIATELY to prevent GitHub webhook timeout
        res.status(200).json({ message: `Successfully updated ${generatedCount} files. Build running in background.` });

        const buildScriptPath = path.join(__dirname, "../build/build.js");

        // Spawn process in background and stream logs
        const buildProcess = spawn("node", [buildScriptPath, "--webhook"]);

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
app.post("/api/github", csrfProtection, requireAuth, requireRole('admin', 'editor'), async (req, res) => {
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

        const foundFiles = scanCodeFiles(downloadedFolderPath);
        console.log(`[GitHub API] Inspector found ${foundFiles.length} code files.`);

        if (foundFiles.length === 0) {
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

        let generatedCount = 0;

        for (const file of foundFiles) {
            await new Promise(resolve => setTimeout(resolve, 4000));
            const markdownOutput = await generateDocs(file, codeMap);

            if (markdownOutput) {
                const relativePath = path.relative(downloadedFolderPath, file.path);
                const parsedPath = path.parse(relativePath);
                const nestedTargetDir = path.join(targetDir, parsedPath.dir);
                
                if (!fs.existsSync(nestedTargetDir)) {
                    fs.mkdirSync(nestedTargetDir, { recursive: true });
                }

                const mdFilePath = path.join(nestedTargetDir, `${parsedPath.name}.mdx`);
                fs.writeFileSync(mdFilePath, markdownOutput);
                console.log(`Saved AI Doc: ${mdFilePath}`);
                generatedCount++;
            }
        }

        console.log("[GitHub API] Waking up the Factory Worker (build.js)...");
        
        res.json({
            message: "GitHub Repository successfully converted into documentation! Build compiling in background.",
            fileProcessed: generatedCount,
            tenant: tenantName,
            version: projectName
        });

        const buildScriptPath = path.join(__dirname, "../build/build.js");
        const buildProcess = spawn("node", [buildScriptPath]);

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

// NEW: Require Admin to save settings
app.post('/api/settings', csrfProtection, requireAuth, requireRole('admin'), async (req, res) => {
    const tenant = sanitizeString(req.body.tenant, 64);
    const version = sanitizeString(req.body.version, 64);
    const { primaryColor, logoUrl, fontFamily, darkMode } = req.body;

    const config = {
        name: version,
        theme: { primaryColor, logoUrl, fontFamily, darkMode },
        updatedAt: new Date().toISOString()
    };

    const configPath = path.join(__dirname, '../docs', tenant, version, 'docgen.json');
    const configDir  = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
        return res.status(404).json({ error: 'Project not found' });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    res.json({ message: 'Settings saved. Rebuilding site in background...' });

    const buildScriptPath = path.join(__dirname, '../build/build.js');
    const buildProcess = spawn("node", [buildScriptPath]);
    
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

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});