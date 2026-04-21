const express = require("express");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const validator = require("validator");
const { sendSuccessEmail } = require("../emailService");

// Notice the '../' because we are now inside the routes folder!
const cloneRepo = require("../gitServices");
const scanCodeFiles = require("../codeScanner");
const generateDocs = require("../aiWriter");
const analyzeRepo = require("../repoAnalyzer");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

function sanitizeString(input, maxLength = 100) {
    if (!input || typeof input !== 'string') return '';
    return validator.escape(input.trim()).slice(0, maxLength);
}

// PUBLIC ROUTE: No auth required, but strictly limited!
router.post("/github", async (req, res) => {
    const repoUrl = req.body.repoUrl; 
    const projectName = sanitizeString(req.body.projectName, 64);
    const tenantName  = sanitizeString(req.body.tenantName, 64);
    const email = sanitizeString(req.body.email, 100);

    if (!repoUrl || !projectName || !tenantName) {
        return res.status(400).json({ error: "Missing repository details." });
    }

    // --- NEW: CREATE THE ORPHAN RECORD ---
    // Check if the project already exists
    const { data: existingProject } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_name', tenantName)
        .eq('project_name', projectName)
        .single();

    // If it doesn't exist, create an orphan row (user_id is null)
    if (!existingProject) {
        await supabase.from('projects').insert({
            tenant_name: tenantName,
            project_name: projectName,
            status: 'running',
            user_id: null // <-- This makes it an orphan!
        });
    } else {
        await supabase.from('projects')
            .update({ status: 'running' })
            .eq('id', existingProject.id);
    }

    try {
        console.log(`\n [Public API] Starting free preview request for ${repoUrl}...`);
        
        // --- 1. THE AMNESIA FIX (Safe Database Query) ---
        // Using limit(1).maybeSingle() prevents crashes if a duplicate ever sneaks in
        const { data: existingProject, error: searchError } = await supabase
            .from('projects')
            .select('id, status')
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName)
            .limit(1)
            .maybeSingle();

        if (existingProject) {
            // Cache Hit: It's already done!
            if (existingProject.status === 'successful') {
                console.log(`[Public API] 🟢 Cache hit! Docs for ${projectName} already exist.`);
                return res.json({
                    message: "Documentation already exists! Redirecting...",
                    tenant: tenantName,
                    version: projectName,
                    cached: true 
                });
            }
            
            // Conflict: Someone else is already generating it right now!
            if (existingProject.status === 'running') {
                console.log(`[Public API] 🟡 Generation already in progress for ${projectName}.`);
                return res.status(409).json({ 
                    error: "Documentation generation is already in progress. Please check back in a few minutes." 
                });
            }

            // Recovery: It exists but previously failed. Update it!
            await supabase.from('projects')
                .update({ status: 'running', repo_url: repoUrl })
                .eq('id', existingProject.id);
                
        } else {
            // Brand New: Insert a fresh row
            await supabase.from('projects').insert([{
                tenant_name: tenantName,
                project_name: projectName,
                repo_url: repoUrl,
                status: 'running',
            }]);
        }

        // --- 2. THE GENERATION PROCESS ---
        const downloadedFolderPath = await cloneRepo(repoUrl, projectName);
        const codeMap = analyzeRepo(downloadedFolderPath);
        const foundFiles = scanCodeFiles(downloadedFolderPath);

        if (foundFiles.length === 0) {
            // Update the DB to 'failed' before telling the frontend!
            await supabase.from('projects').update({ status: 'failed' }).eq('tenant_name', tenantName).eq('project_name', projectName);
            return res.status(404).json({ error: "No code files found." });
        }

        // The PLG Trick: Only grab the first 3 files for the free preview
        const previewFiles = foundFiles.slice(0, 3);
        console.log(`[Public API] Generating ${previewFiles.length} preview files to save credits...`);

        const targetDir = path.join(__dirname, "../../docs", tenantName, projectName);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        // Generate the docs
        for (const file of previewFiles) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Respect rate limits
            const markdownOutput = await generateDocs(file, codeMap);

            if (markdownOutput) {
                const relativePath = path.relative(downloadedFolderPath, file.path);
                const parsedPath = path.parse(relativePath);
                const nestedTargetDir = path.join(targetDir, parsedPath.dir);
                
                if (!fs.existsSync(nestedTargetDir)) fs.mkdirSync(nestedTargetDir, { recursive: true });

                const mdFilePath = path.join(nestedTargetDir, `${parsedPath.name}.mdx`);
                fs.writeFileSync(mdFilePath, markdownOutput);
            }
        }

        console.log("[Public API] Preview generation finished. Starting build worker...");
        
        // --- 3. THE WORKER SYNC FIX ---
        const buildScriptPath = path.join(__dirname, "../../build/build.js");
        const targetScope = `${tenantName}/${projectName}`;
        
        // Wrap the worker in a Promise so the backend WAITS for it to finish!
        await new Promise((resolve, reject) => {
            const buildProcess = spawn("node", [buildScriptPath, "--scope", targetScope]);

            buildProcess.stdout.on("data", (data) => process.stdout.write(`[Worker] ${data}`));
            buildProcess.stderr.on("data", (data) => console.error(`[Worker Error] ${data}`));

            buildProcess.on("close", (code) => {
                if (code === 0) resolve();
                else reject(new Error("Build worker failed"));
            });
        });

        // Mark as successful in DB ONLY AFTER the worker is completely done
        await supabase.from('projects')
            .update({ status: 'successful' })
            .eq('tenant_name', tenantName)
            .eq('project_name', projectName);

            if (email) {
            sendSuccessEmail(email, tenantName, projectName);
        }

        // --- 4. THE FINAL RESPONSE ---
        // NOW we tell the frontend it is safe to redirect!
        res.json({
            message: "Documentation generated successfully!",
            tenant: tenantName,
            version: projectName,
            cached: false
        });

    } catch (error) {
        console.error("Public API Error:", error);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate preview." });
    }
});

module.exports = router;