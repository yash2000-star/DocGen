const { GoogleGenAI } = require("@google/genai");
const { config } = require("./config");
const editDocs = require("./aiEditor");

// The writer uses Vertex AI when a Google Cloud project is configured, otherwise a Gemini API key.
// The client is created lazily so the server can boot without AI credentials.
let clientInstance = null;
function getWriterClient() {
    if (!clientInstance) {
        if (config.vertex.project) {
            clientInstance = new GoogleGenAI({
                vertexai: true,
                project: config.vertex.project,
                location: config.vertex.location,
            });
        } else if (config.gemini.apiKey) {
            clientInstance = new GoogleGenAI({ apiKey: config.gemini.apiKey });
        } else {
            throw new Error("AI writer is not configured. Set GEMINI_API_KEY (or GOOGLE_CLOUD_PROJECT) in backend/.env.");
        }
    }
    return clientInstance;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: THE SUPER-ARCHITECT
// Analyzes the ENTIRE codebase and generates a conceptual multi-page site plan.
// This is the brain — it decides what pages to create, not just group files.
// ═══════════════════════════════════════════════════════════════════════════════

async function generateArchitectBlueprint(codeFiles, contextFiles, projectName) {

    // Build a comprehensive source digest for the AI
    let sourceDigest = "";

    // Priority 1: README (the human-written project description)
    const readme = contextFiles.find(f => f.type === "readme");
    if (readme) {
        sourceDigest += `\n### README.md\n${readme.code}\n`;
    }

    // Priority 2: package.json (dependencies, scripts, project metadata)
    const pkg = contextFiles.find(f => f.type === "package");
    if (pkg) {
        sourceDigest += `\n### package.json\n${pkg.code}\n`;
    }

    // Priority 3: All code files (with paths for structure understanding)
    for (const file of codeFiles) {
        const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
        sourceDigest += `\n### ${shortPath}\n\`\`\`\n${file.code.substring(0, 8000)}\n\`\`\`\n`;
    }

    // Priority 4: HTML files (for frontend-heavy projects)
    const htmlFiles = contextFiles.filter(f => f.type === "html");
    for (const file of htmlFiles) {
        const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
        sourceDigest += `\n### ${shortPath}\n\`\`\`html\n${file.code.substring(0, 5000)}\n\`\`\`\n`;
    }

    // Priority 5: CSS files
    const cssFiles = contextFiles.filter(f => f.type === "style");
    for (const file of cssFiles) {
        const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
        sourceDigest += `\n### ${shortPath}\n\`\`\`css\n${file.code.substring(0, 3000)}\n\`\`\`\n`;
    }

    const prompt = `You are the Documentation Architect at Mintlify. You design documentation sites that feel like they were written by a real human technical writer — not auto-generated.

## YOUR MISSION
Analyze this entire codebase and design a complete, multi-page documentation site plan. You are NOT mapping one file to one page. You are designing a documentation EXPERIENCE.

## HOW MINTLIFY THINKS
Mintlify generates conceptual pages, not file dumps. For example, from a simple weather app with 3 files (index.html, script.js, style.css), Mintlify creates:
- "Introduction" — welcoming overview with feature cards
- "Quickstart" — get running in 2 minutes
- "Setup" — environment & dependencies  
- "Getting an API key" — external knowledge about APIs used
- "Customization" — how to modify the app
- "Weather data" — API/data reference
- "UI components" — DOM element reference

Notice: Most pages DON'T map 1:1 to a source file. They are synthesized from the ENTIRE codebase.

## RULES FOR PAGE DESIGN

1. ALWAYS create an "introduction" page — a warm, professional overview of the entire project.
2. ALWAYS create a "quickstart" page — the fastest path to seeing results (clone, install, run).
3. Create GUIDE pages for important topics the user needs to understand (setup, config, API keys, customization, deployment).
4. Create REFERENCE pages for technical deep-dives (API routes, data models, components, utilities).
5. Each page must have a clear, singular purpose. Never dump everything on one page.
6. Use human-readable titles, NOT filenames. "Task Management API" not "index.js".
7. Aim for 5-10 pages total. Quality over quantity.
8. Group pages into exactly 3 sidebar categories:
   - "Get Started" — Introduction, Quickstart (onboarding)
   - "Guides" — Task-oriented how-to pages (setup, config, customization)
   - "Reference" — Technical deep-dives (API, data models, components)

## OUTPUT FORMAT
Output ONLY valid JSON matching this exact structure. No markdown fences. No explanation.

{
  "projectName": "Human Readable Project Name",
  "projectDescription": "One sentence describing what this project does.",
  "pages": [
    {
      "slug": "introduction",
      "title": "Introduction",
      "group": "Get Started",
      "type": "synthetic",
      "purpose": "Explain what this project does at a high level",
      "sourceContext": "all",
      "writingInstructions": "Write a warm overview. Use CardGroup to highlight key features. Link to Quickstart."
    },
    {
      "slug": "quickstart",
      "title": "Quickstart",
      "group": "Get Started",
      "type": "synthetic",
      "purpose": "Get the user from zero to running in under 2 minutes",
      "sourceContext": "package.json, README, entry file",
      "writingInstructions": "Use Steps component. Show exact terminal commands. End with a Check callout."
    }
  ]
}

## IMPORTANT RULES FOR THE JSON
- "slug" must be a URL-safe string (lowercase, hyphens, no spaces)
- "type" is either "synthetic" (conceptual page) or "reference" (maps to specific code)
- "sourceContext" tells the Ghostwriter which files to focus on. Use "all" for overview pages.
- "writingInstructions" gives the Ghostwriter specific guidance for this page's style and components.
- Every page MUST have writingInstructions. Be specific about which MDX components to use.

## THE CODEBASE TO ANALYZE

Project: ${projectName}
${sourceDigest}

OUTPUT ONLY VALID JSON. No backticks. No explanation. Raw JSON only.`;

    try {
        console.log(`\n🏛️  Super-Architect is designing the documentation site plan...`);
        const response = await getWriterClient().models.generateContent({
            model: config.gemini.writerModel,
            contents: prompt,
            config: {
                maxOutputTokens: 8192,
                temperature: 0.4
            }
        });
        let rawText = response.text.trim();

        // Strip markdown backticks if AI hallucinates them
        if (rawText.startsWith('```json')) {
            rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const blueprint = JSON.parse(rawText);

        // Validate the structure
        if (!blueprint.pages || !Array.isArray(blueprint.pages)) {
            throw new Error("Blueprint missing 'pages' array");
        }

        console.log(`✅ Architect designed ${blueprint.pages.length} pages across the site.`);
        blueprint.pages.forEach(p => console.log(`   📄 [${p.group}] ${p.title} (${p.type})`));

        return blueprint;
    } catch (error) {
        console.error("❌ Super-Architect failed:", error);
        // Fallback: generate a minimal 2-page plan
        return {
            projectName: projectName,
            projectDescription: `Documentation for ${projectName}`,
            pages: [
                {
                    slug: "introduction",
                    title: "Introduction",
                    group: "Get Started",
                    type: "synthetic",
                    purpose: "Project overview",
                    sourceContext: "all",
                    writingInstructions: "Write a professional overview of the project."
                },
                {
                    slug: "quickstart",
                    title: "Quickstart",
                    group: "Get Started",
                    type: "synthetic",
                    purpose: "Get started quickly",
                    sourceContext: "all",
                    writingInstructions: "Write a step-by-step guide to run the project."
                }
            ]
        };
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2: THE CONTEXT-AWARE GHOSTWRITER
// Writes individual pages using the Architect's plan + full codebase context.
// Each page is written differently based on its type and purpose.
// ═══════════════════════════════════════════════════════════════════════════════

async function generatePage(pagePlan, allCodeFiles, allContextFiles, fullBlueprint) {

    // Build the source context based on what the Architect requested
    let relevantSource = "";

    if (pagePlan.sourceContext === "all") {
        // Overview pages get everything (truncated)
        const readme = allContextFiles.find(f => f.type === "readme");
        if (readme) relevantSource += `### README.md\n${readme.code}\n\n`;

        const pkg = allContextFiles.find(f => f.type === "package");
        if (pkg) relevantSource += `### package.json\n${pkg.code}\n\n`;

        for (const file of allCodeFiles) {
            const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
            relevantSource += `### ${shortPath}\n\`\`\`\n${file.code.substring(0, 4000)}\n\`\`\`\n\n`;
        }

        for (const file of allContextFiles.filter(f => f.type === "html" || f.type === "style")) {
            const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
            relevantSource += `### ${shortPath}\n\`\`\`\n${file.code.substring(0, 3000)}\n\`\`\`\n\n`;
        }
    } else {
        // Specific pages get targeted files
        const targetNames = pagePlan.sourceContext.split(",").map(s => s.trim().toLowerCase());

        for (const file of [...allCodeFiles, ...allContextFiles]) {
            const fileName = file.path.split(/[/\\]/).pop().toLowerCase();
            const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
            if (targetNames.some(t => fileName.includes(t) || shortPath.toLowerCase().includes(t))) {
                relevantSource += `### ${shortPath}\n\`\`\`\n${file.code.substring(0, 6000)}\n\`\`\`\n\n`;
            }
        }

        // If no specific files matched, provide everything as fallback
        if (!relevantSource) {
            for (const file of allCodeFiles) {
                const shortPath = file.path.split(/[/\\]/).slice(-3).join("/");
                relevantSource += `### ${shortPath}\n\`\`\`\n${file.code.substring(0, 4000)}\n\`\`\`\n\n`;
            }
        }
    }

    // Build the navigation context so pages can reference each other
    const navContext = fullBlueprint.pages.map(p => `- [${p.title}](/${p.slug})`).join("\n");

    const prompt = `You are an elite Technical Writer at Mintlify. You write documentation that feels like it was crafted by a real person — warm, professional, concise, and genuinely helpful. Your docs should feel like MongoDB's official docs or Stripe's API reference — premium and polished.

## YOUR ASSIGNMENT
Write the "${pagePlan.title}" page for the "${fullBlueprint.projectName}" documentation site.

## PAGE DETAILS
- **Title**: ${pagePlan.title}
- **Slug**: ${pagePlan.slug}
- **Category**: ${pagePlan.group}
- **Purpose**: ${pagePlan.purpose}
- **Page Type**: ${pagePlan.type}

## ARCHITECT'S WRITING INSTRUCTIONS
${pagePlan.writingInstructions}

## THE FULL SITE MAP (so you can reference other pages)
${navContext}

## YOUR MDX COMPONENT TOOLKIT

Use these components generously to make the documentation feel rich and interactive:

### Callouts (use instead of plain blockquotes — ALWAYS)
- \`<Note>\` — helpful tips, extra context
- \`<Tip>\` — pro tips, shortcuts, best practices
- \`<Info>\` — neutral important information
- \`<Warning>\` — security risks, destructive actions
- \`<Danger>\` — critical failures, breaking changes
- \`<Check>\` — success confirmations, completed steps

### Steps (use for ANY sequential process — NEVER plain numbered lists)
\`\`\`mdx
<Steps>
  <Step title="Install dependencies">
    \`\`\`bash
    npm install
    \`\`\`
  </Step>
  <Step title="Start the server">
    \`\`\`bash
    npm run dev
    \`\`\`
  </Step>
</Steps>
\`\`\`

### Cards (use for feature highlights, navigation, module overviews)
\`\`\`mdx
<CardGroup cols={2}>
  <Card title="Feature" icon="⚡">
    Description of the feature.
  </Card>
</CardGroup>
\`\`\`

### Code (use CodeGroup for multi-language, always specify language)
\`\`\`mdx
<CodeGroup>
\`\`\`javascript JavaScript
const response = await fetch('/api/users');
\`\`\`
\`\`\`bash cURL
curl -X GET https://api.example.com/users
\`\`\`
</CodeGroup>
\`\`\`

### API Documentation
- \`<ParamField name="email" type="string" required>\` — for function/API parameters
- \`<ResponseField name="token" type="string">\` — for return values
- \`<ApiPlayground method="POST" endpoint="/api/users" />\` — interactive API testing

### Other Components
- \`<AccordionGroup>\` + \`<Accordion title="Question">\` — for FAQs
- \`<Badge>NEW</Badge>\` — inline labels
- \`<Tooltip tip="explanation">term</Tooltip>\` — hover definitions

## WRITING STYLE RULES (THIS IS CRITICAL)

1. **Be concise.** Short paragraphs (2-3 sentences max). No fluff. No filler.
2. **Be action-oriented.** "Clone the repository" not "You might want to consider cloning the repository."
3. **Use components aggressively.** Every procedure → Steps. Every tip → Note/Tip. Every feature list → CardGroup.
4. **Write for humans.** Imagine a developer at 11pm trying to get this working. Be clear, direct, and helpful.
5. **Add real value.** Don't just describe what the code does — explain WHY and WHEN to use it.
6. **Cross-reference.** Mention other pages in the site ("See the [Quickstart](/quickstart) guide to get started.")
7. **Use external knowledge.** If the code uses an API (like OpenWeatherMap), explain how to get API keys, rate limits, etc.
8. **No redundancy.** Never repeat the title in the first sentence. Start with substance.

## REQUIRED FRONTMATTER FORMAT
Start your output with EXACTLY this YAML frontmatter:
---
title: "${pagePlan.title}"
group: "${pagePlan.group}"
order: ${fullBlueprint.pages.indexOf(pagePlan) + 1}
---

## SOURCE CODE CONTEXT
${relevantSource}

## OUTPUT RULES
1. Output ONLY raw MDX starting with the --- frontmatter. No preamble. No wrapper fences.
2. Never invent component names not in the toolkit above.
3. Every code block must have a language tag.
4. The document should feel like a premium, hand-crafted page — not an AI dump.`;

    try {
        console.log(`\n✍️  Ghostwriter is crafting: "${pagePlan.title}" [${pagePlan.type}]...`);

        const response = await getWriterClient().models.generateContent({
            model: config.gemini.writerModel,
            contents: prompt,
            config: {
                maxOutputTokens: 8192,
                temperature: 0.5
            }
        });
        const draftText = response.text;

        console.log(`✅ Ghostwriter drafted "${pagePlan.title}". Passing to Critic...`);

        // Pass to the editor for cleanup and validation
        const sourceCode = allCodeFiles.map(f => f.code).join("\n\n---\n\n").substring(0, 15000);
        const finalPolishedText = await editDocs(draftText, sourceCode);

        return finalPolishedText;
    } catch (error) {
        console.error(`❌ Ghostwriter failed on "${pagePlan.title}":`, error);
        return null;
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// The old generateDocs function is preserved as a fallback
async function generateDocs(file, codeMap, blueprint) {
    // Wrap the old single-file call into the new page-based system
    const pagePlan = {
        slug: file.path.split(/[/\\]/).pop().replace(/\.[^.]+$/, ''),
        title: file.path.split(/[/\\]/).pop(),
        group: "Reference",
        type: "reference",
        purpose: `Document the ${file.path.split(/[/\\]/).pop()} file`,
        sourceContext: "all",
        writingInstructions: "Write a detailed reference page for this source file."
    };

    const dummyBlueprint = {
        projectName: "Project",
        pages: [pagePlan]
    };

    return await generatePage(pagePlan, [file], [], dummyBlueprint);
}

module.exports = { generateDocs, generatePage, generateArchitectBlueprint };