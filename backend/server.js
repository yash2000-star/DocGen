const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process"); // Swapped exec for spawn

const cloneRepo = require("./gitServices");
const scanCodeFiles = require("./codeScanner");
const generateDocs = require("./aiWriter");
const analyzeRepo = require("./repoAnalyzer");

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

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});
app.use("/api/static", express.static(path.join(__dirname, "../dist")));

app.get("/", (req, res) => {
    res.send("Docs API is running smoothly!");
});

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

app.post("/api/github", async (req, res) => {
    const { repoUrl, projectName, tenantName } = req.body;

    if (!repoUrl || !projectName || !tenantName) {
        return res.status(400).json({ error: "Missing repoUrl, projectName, or tenantName" });
    }

    try {
        // --- NEW ARCHITECTURE: Update 'projects' table directly ---
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
        
        // Respond IMMEDIATELY before the build script runs
        res.json({
            message: "GitHub Repository successfully converted into documentation! Build compiling in background.",
            fileProcessed: generatedCount,
            tenant: tenantName,
            version: projectName
        });

        const buildScriptPath = path.join(__dirname, "../build/build.js");

        // Spawn in background
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

app.post('/api/settings', async (req, res) => {
    const { tenant, version, primaryColor, logoUrl, fontFamily, darkMode } = req.body;

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

    // Respond immediately
    res.json({ message: 'Settings saved. Rebuilding site in background...' });

    const buildScriptPath = path.join(__dirname, '../build/build.js');
    const buildProcess = spawn("node", [buildScriptPath]);
    
    buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
    buildProcess.stderr.on("data", (data) => process.stderr.write(`[Worker Error] ${data}`));
});

app.delete('/api/projects/:tenant/:version', async (req, res) => {
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

app.post("/api/docs", (req, res) => {
    const { tenant, version, fileName, content } = req.body;

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

        // Respond immediately
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

// --- SAAS FEATURE: API Playground Proxy ---
// This safely routes requests from the React frontend to bypass CORS
app.post("/api/proxy", async (req, res) => {
    const { targetUrl, targetMethod, payload } = req.body;

    if (!targetUrl || !targetMethod) {
        return res.status(400).json({ error: "Missing targetUrl or targetMethod." });
    }

    try {
        console.log(`\n🔌 [Proxy] Forwarding ${targetMethod} request to: ${targetUrl}`);
        
        // Construct the fetch options
        const fetchOptions = {
            method: targetMethod,
            headers: {
                "Content-Type": "application/json",
                // If you add Authentication headers to your playground later, they pass through here!
            }
        };

        // Only attach a body if it's not a GET or DELETE request
        if (payload && targetMethod !== "GET" && targetMethod !== "DELETE") {
            fetchOptions.body = JSON.stringify(payload);
        }

        // The Node.js server makes the actual request (Bypassing CORS!)
        const externalResponse = await fetch(targetUrl, fetchOptions);
        
        // Parse the response from the destination server
        const data = await externalResponse.json().catch(() => ({}));

        // Send the data safely back to the React frontend
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