const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process")

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
const { stdout, stderr } = require("process");

const app = express();

app.use(cors());
app.use(express.json());
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
        return res.status(400).json({ message: "Not a vaild push event." })
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
        return res.status(200).json({ message: "No revelent files changed." });
    }

    try {
        console.log(`\n [Webhook] Detected changes in ${filesToProcess.length} files. Startign targeted update...`);

        const downloadedFolderPath = await cloneRepo(repoUrl, projectName);

        const targetDir = path.join(__dirname, "../docs", tenantName, projectName);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        let generatedCount = 0;

        for (const relativeFilePath of filesToProcess) {
            const fullPath = path.join(downloadedFolderPath, relativeFilePath);

            if (fs.existsSync(fullPath)) {
                const content = fs. readFileSync(fullPath, "utf-8");
                const fileObj = { path: fullPath, code: content };
                
                const codeMap = analyzeRepo(downloadedFolderPath);
                const markdownOutput = await generateDocs(fileObj, codeMap);

                if (markdownOutput) {
                   const parsedPath = path.parse(relativeFilePath);
                   const nestedTargetDir = path.join(targetDir, parsedPath.dir);
                   
                   if (!fs.existsSync(nestedTargetDir)) {
                    fs.mkdirSync(nestedTargetDir, { recursive: true });
                   }

                   const mdFilePath =path.join(nestedTargetDir, `${parsedPath.name}.mdx`);

                    fs.writeFileSync(mdFilePath, markdownOutput);
                    console.log(`[Webhook] Updated AI Doc: ${mdFilePath}`);
                    generatedCount++;
                }
            }
        }

        console.log("[webhook] Waking up the factory Worker...");
        const buildScriptPath = path.join(__dirname, "../build/build.js");

        exec(`node "${buildScriptPath}" --webhook`, (error, stdout, stderr) => {
            if (error) {
                console.error("Webhook Build failed:", stderr);
                return;
            }
            console.log("Factory Worker Output:\n", stdout);
            console.log("Targeted webhook update complete!");
        });

        res.status(200).json({ message: `Successfully updated ${generatedCount} files.` });
    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ error: "Failed to process webhooks." });
    }
});

app.post("/api/github", async (req, res) => {
    const { repoUrl, projectName, tenantName } = req.body;

    if (!repoUrl || !projectName || !tenantName) {
        return res.status(400).json({ error: "Missing repoUrl, projectName, or tenantName" });
    }

    try {
        console.log(`\n [GitHub API] Starting pipeline for ${repoUrl}...`);

        const downloadedFolderPath = await cloneRepo(repoUrl, projectName);

        console.log(`[GitHub API] Analyzing repository architecture...`);
        const codeMap = analyzeRepo(downloadedFolderPath);
        console.log(`[GitHub API] Code Map generated successfully.`);

        const foundFiles = scanCodeFiles(downloadedFolderPath);
        console.log(`[GitHub API] Inspector found ${foundFiles.length} code files.`);

        if (foundFiles.length === 0) {
            return res.status(404).json({ error: "No vaild code files found in this repository."})
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
        const buildScriptPath = path.join(__dirname, "../build/build.js");

        exec(`node "${buildScriptPath}"`, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
            if (error) {
                console.error("Factory Build failed:", stderr);
                return res.status(500).json({ error: "Docs generated, but build failed." })
            }

            console.log("Factory Worker Output:\n", stdout);

            res.json({
                message: "GitHub Repository successfully converted into documentation!",
                fileProcessed: generatedCount,
                tenant: tenantName,
                version: projectName
            });
        });
    } catch (error) {
        console.error("GitHub API Error", error);
        res.status(500).json({ error: "Failed to process the GitHub repository." })
    }
})

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

        const buildScriptPath = path.join(__dirname, "../build/build.js");
        const targetRoute = `${tenant}/${version}/${fileName}`;

        exec(`node "${buildScriptPath}" ${targetRoute}`, (error, stdout, stderr) => {
            if (error) {
                console.log("Build failed:", stderr);
                return res.status(500).json({ error: "File saved, but build failed." });
            }

            console.log("Compiler Output:", stdout);

            res.json({
                message: "Document saved and Engine successfully rebuilt!",
                tenant,
                version,
                fileName
            });
        });
    } catch (err) {
        console.error("Error saving file:", err);
        res.status(500).json({ error: "Failed to save the file." });
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

        /*if (!topChunks || topChunks.length === 0) {
            console.log("No relevant documentation found in the cloud.");
            return res.json({ answer: "I'm sorry, I cannot find the answer to that in the current documentation."});
        }

        const chunksPath = path.join(__dirname, "../dist", tenant, version, "aiChunks.json");

        console.log("🕵️ DEBUG: Node is looking for ->", chunksPath);

        if (!fs.existsSync(chunksPath)) {
            return res.status(404).json({ error: "Documentation not found for this tenant." });
        }

        const rawData = fs.readFileSync(chunksPath, "utf-8");
        const aiChunks = JSON.parse(rawData);

        console.log(`\n Calculating math vector for questions: "${question}"`);

        const embedResult = await embeddingModel.embedContent(question);
        const questionVector = embedResult.embedding.values;

        const scoredChunks = aiChunks.map(chunk => {
            if (!chunk.embedding) {
                return { ...chunk, score: -1};
            }

            const mathScore = cosineSimilarity(questionVector, chunk.embedding);

            return { ...chunk, score: mathScore};
        });

        const topChunks = scoredChunks
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

        console.log("Top 3 Match Scores:");
        topChunks.forEach((c, i) => console.log(` ${i + 1}: Score ${c.score.toFixed(3)} -> ${c.text.substring(0,40)}...`));

        const contextString = topChunks.map(c => c.text).join("\n\n");

        console.log("Sending context to Gemini...");
        const answer = await askAI(question, contextString);

        res.json({ answer: answer }); */

    } catch (error) {
        console.error("Ask API Error:", error);
        res.status(500).json({ error: "Internal server error." });
    }
})

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});