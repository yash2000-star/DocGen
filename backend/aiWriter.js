const editDocs = require("./aiEditor");
const { isFatalLLMError } = require("./ai/errors");
const { buildSourceDigest } = require("./ai/sourceDigest");
const { stripCodeFence } = require("./ai/text");
const { ensureValidMdx } = require("./mdx/repair");

// Every function here takes `llm`: the user's own AI provider, from getUserLLM().
//   { client, writerModel, criticModel, promptBudgetTokens? }
// Prompt size is capped so large repos fit in the model's context window.
const DEFAULT_PROMPT_BUDGET_TOKENS = 60000;
const budgetFor = (llm) => llm.promptBudgetTokens || DEFAULT_PROMPT_BUDGET_TOKENS;

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1: THE SUPER-ARCHITECT
// Analyzes the ENTIRE codebase and generates a conceptual multi-page site plan.
// This is the brain — it decides what pages to create, not just group files.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @param {object} [options]
 * @param {{ specPath: string, operations: number, tags: string[] }} [options.apiReference] -
 *   Set when an OpenAPI spec was found: its reference pages are generated from the spec, so
 *   the plan shouldn't document endpoints one by one.
 */
async function generateArchitectBlueprint(codeFiles, contextFiles, projectName, llm, { apiReference } = {}) {

    // A digest of the codebase, most important files first, within the prompt budget.
    const { text: sourceDigest, omitted } = buildSourceDigest({ codeFiles, contextFiles, budgetTokens: budgetFor(llm) });
    if (omitted.length > 0) {
        console.log(`[Architect] Prompt budget reached; ${omitted.length} files listed by name only.`);
    }

    const prompt = `You are the Documentation Architect at Mintlify. You design documentation sites that feel like they were written by a real human technical writer — not auto-generated.

## YOUR MISSION
Analyze this entire codebase and design a complete, multi-page documentation site plan. You are NOT mapping one file to one page. You are designing a documentation EXPERIENCE.

## HOW MINTLIFY THINKS
Mintlify generates conceptual pages, not file dumps. For example, from a simple weather app with 3 files (index.html, script.js, style.css), Mintlify creates:
- "Introduction" — welcoming overview with feature cards
- "Quickstart" — get running in 2 minutes
- "Setup" — environment & dependencies  
- "Getting an API key" — only because the code calls a weather API
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
9. Plan only pages the codebase supports. Don't plan pages about features, services or settings the code doesn't have.${apiReference ? `
10. An API reference is generated automatically from the OpenAPI spec \`${apiReference.specPath}\` (${apiReference.operations} endpoints${apiReference.tags.length ? `, groups: ${apiReference.tags.slice(0, 10).join(", ")}` : ""}). Do NOT plan pages that document individual endpoints. You may plan one guide on using the API (authentication, errors, pagination) that links to the reference at /api-reference.` : ""}

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
        const response = await llm.client.generateText({
            model: llm.writerModel,
            prompt,
            temperature: 0.4,
        });
        if (response.truncated) {
            console.warn("[Architect] The response hit the output limit; the plan may be incomplete.");
        }

        const blueprint = JSON.parse(stripCodeFence(response.text));

        // Validate the structure, and drop pages missing the fields the writer needs
        if (!blueprint.pages || !Array.isArray(blueprint.pages)) {
            throw new Error("Blueprint missing 'pages' array");
        }
        blueprint.pages = blueprint.pages.filter((p) => p && p.slug && p.title && p.group);
        if (blueprint.pages.length === 0) {
            throw new Error("Blueprint has no usable pages");
        }

        console.log(`✅ Architect designed ${blueprint.pages.length} pages across the site.`);
        blueprint.pages.forEach(p => console.log(`   📄 [${p.group}] ${p.title} (${p.type})`));

        return blueprint;
    } catch (error) {
        // A bad key or missing model would fail every later call too: stop the run.
        if (isFatalLLMError(error)) throw error;
        console.error("❌ Super-Architect failed:", error.message);
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

async function generatePage(pagePlan, allCodeFiles, allContextFiles, fullBlueprint, llm, { onDraft } = {}) {

    // Build the source context based on what the Architect requested
    const budgetTokens = budgetFor(llm);
    let relevantSource = "";

    if (pagePlan.sourceContext !== "all" && typeof pagePlan.sourceContext === "string") {
        // Specific pages get targeted files
        const targetNames = pagePlan.sourceContext.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        const matches = (file) => {
            const fileName = file.path.split(/[/\\]/).pop().toLowerCase();
            const shortPath = file.path.split(/[/\\]/).slice(-3).join("/").toLowerCase();
            return targetNames.some(t => fileName.includes(t) || shortPath.includes(t));
        };
        const targetedCode = allCodeFiles.filter(matches);
        const targetedContext = allContextFiles.filter(matches);
        if (targetedCode.length + targetedContext.length > 0) {
            relevantSource = buildSourceDigest({
                codeFiles: targetedCode,
                contextFiles: targetedContext,
                budgetTokens,
                maxChars: { code: 6000, html: 6000, style: 6000 },
            }).text;
        }
    }

    // Overview pages, and pages whose files didn't match, get everything (truncated)
    if (!relevantSource) {
        relevantSource = buildSourceDigest({
            codeFiles: allCodeFiles,
            contextFiles: allContextFiles,
            budgetTokens,
            maxChars: { code: 4000, html: 3000, style: 3000 },
        }).text;
    }

    // Build the navigation context so pages can reference each other
    const navContext = [
        ...fullBlueprint.pages.map(p => `- [${p.title}](/${p.slug})`),
        ...(fullBlueprint.apiReference ? ["- [API reference](/api-reference) (generated from the OpenAPI spec: link here for endpoint details)"] : []),
    ].join("\n");

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
  <Card title="Feature" icon="zap">
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

### Icons
Card and Accordion \`icon\` values are icon names, never emoji: rocket, zap, code, book-open, settings, terminal, key, shield, database, globe, package, wrench, file-text, users, layers.

## WRITING STYLE RULES (THIS IS CRITICAL)

1. **Be concise.** Short paragraphs (2-3 sentences max). No fluff. No filler.
2. **Be action-oriented.** "Clone the repository" not "You might want to consider cloning the repository."
3. **Use components aggressively.** Every procedure → Steps. Every tip → Note/Tip. Every feature list → CardGroup.
4. **Write for humans.** Imagine a developer at 11pm trying to get this working. Be clear, direct, and helpful.
5. **Add real value.** Don't just describe what the code does — explain WHY and WHEN to use it.
6. **Cross-reference.** Link to other pages from the site map using their exact slug, like [Quickstart](/quickstart). Don't link to pages that aren't in the site map.
7. **Stick to the source.** Describe only files, commands, settings and behaviour you can see in the source code below. Never invent file names, environment variables, npm scripts, packages, endpoints or options. If the code calls an external service, you may say how to get its API key, but don't make up its limits or prices. When unsure, leave it out.
8. **No redundancy.** Never repeat the title in the first sentence. Start with substance.

## REQUIRED FRONTMATTER FORMAT
Start your output with EXACTLY this YAML frontmatter:
---
title: "${pagePlan.title}"
description: "One sentence (under 160 characters) saying what this page helps the reader do."
group: "${pagePlan.group}"
order: ${fullBlueprint.pages.indexOf(pagePlan) + 1}
---

## SOURCE CODE CONTEXT
${relevantSource}

## OUTPUT RULES
1. Output ONLY raw MDX starting with the --- frontmatter. No preamble. No wrapper fences.
2. Never invent component names not in the toolkit above.
3. No import/export statements and no JavaScript in {braces}: prop values are plain text, numbers or JSON. Code in a page is removed before publishing.
4. Every code block must have a language tag.
5. The document should feel like a premium, hand-crafted page — not an AI dump.`;

    try {
        console.log(`\n✍️  Ghostwriter is crafting: "${pagePlan.title}" [${pagePlan.type}]...`);

        const response = await llm.client.generateText({
            model: llm.writerModel,
            prompt,
            temperature: 0.5,
        });
        if (response.truncated) {
            console.warn(`[Ghostwriter] "${pagePlan.title}" hit the output limit and may be cut off.`);
        }
        const draftText = response.text;

        console.log(`✅ Ghostwriter drafted "${pagePlan.title}". Passing to Critic...`);

        // The critic checks the draft against the same source the writer used.
        const finalPolishedText = await editDocs(draftText, relevantSource, llm);

        // Only publish pages that compile; broken ones go back to the critic to fix.
        const checked = await ensureValidMdx(finalPolishedText, llm, pagePlan.title);
        if (!checked) return null;

        // Fact and link checks against the repository (see quality/factCheck.js).
        return onDraft ? await onDraft(checked.mdx, { relevantSource }) : checked.mdx;
    } catch (error) {
        // A bad key or missing model would fail every later page too: stop the run.
        if (isFatalLLMError(error)) throw error;
        console.error(`❌ Ghostwriter failed on "${pagePlan.title}":`, error.message);
        return null;
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY EXPORTS (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

// The old generateDocs function is preserved as a fallback
async function generateDocs(file, llm, options = {}) {
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

    return await generatePage(pagePlan, [file], [], dummyBlueprint, llm, options);
}

module.exports = { generateDocs, generatePage, generateArchitectBlueprint };