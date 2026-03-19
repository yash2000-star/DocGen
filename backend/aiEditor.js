require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ Use flash-lite for editor — saves quota, still accurate for cleanup work
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

async function editDocs(draftMdx, sourceCode = null) {

  // ✅ Include source code context if provided so editor can check accuracy
  const sourceContext = sourceCode
    ? `\n### ORIGINAL SOURCE CODE (use this to verify accuracy):\n\`\`\`javascript\n${sourceCode}\n\`\`\``
    : "";

  const prompt = `You are a ruthless, elite Technical Documentation Editor at a top-tier SaaS company.
Your job is to review an MDX documentation draft and fix ALL formatting, structural, component, and accuracy mistakes.

### PART 1 — FORMATTING CHECKLIST (fix all of these):

1. MARKDOWN FENCE TRAP: Output must NOT be wrapped in \`\`\`mdx blocks. Remove them entirely. File must start with --- YAML frontmatter.
2. HALLUCINATED COMPONENTS: Replace <InlineCode>text</InlineCode> with \`text\`. Replace <Highlight> with **bold**. Replace any invented tags with standard markdown.
3. UNCLOSED TAGS: Every opening <ComponentName> must have a closing </ComponentName>. Fix any that are missing.
4. FRONTMATTER: Must have exactly these three fields at the top, valid YAML syntax:
   ---
   title: "..."
   group: "..."
   order: 1
   ---
5. CODE BLOCKS: Every fenced code block must have a language tag. \`\`\`javascript not just \`\`\`.
6. EMPTY COMPONENTS: Remove any component that has no children — e.g. <Note></Note> or <Step title="x"></Step>.

### PART 2 — ACCURACY CHECKLIST (only if source code is provided):

7. PARAMETER NAMES: Check that every <ParamField> matches the actual parameter names in the source code. Fix any that are wrong.
8. CODE EXAMPLES: Check that code examples use real function names and real parameter shapes from the source code.
9. RETURN VALUES: Check that <ResponseField> descriptions match what the function actually returns.

### STRICTLY ALLOWED COMPONENTS (replace anything else with markdown):
<Note>, <Tip>, <Info>, <Warning>, <Danger>, <Check>, <Steps>, <Step>,
<Card>, <CardGroup>, <CodeGroup>, <Accordion>, <AccordionGroup>,
<ParamField>, <ResponseField>, <Expandable>, <RequestExample>,
<ResponseExample>, <Badge>, <Tooltip>, <Frame>, <Update>, <ApiPlayground>
${sourceContext}

### THE DRAFT TO REVIEW:
${draftMdx}

OUTPUT ONLY THE FINAL POLISHED MDX. NO EXPLANATION. NO PREAMBLE. NO WRAPPER CODE BLOCKS.`;

  try {
    console.log(`\n🕵️  Critic is reviewing the draft...`);

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // ✅ Markdown Fence Sanitizer — removes opening ```mdx or ```
    if (text.startsWith("```")) {
      const firstNewLine = text.indexOf('\n');
      if (firstNewLine !== -1) {
        text = text.substring(firstNewLine + 1).trim();
      }
    }

    // ✅ Remove closing fence if present
    if (text.endsWith("```")) {
      text = text.substring(0, text.length - 3).trim();
    }

    // ✅ HTML Comment Sanitizer — converts <!-- comment --> to {/* comment */}
    // This fixes the React crash caused by raw HTML comments inside MDX
    text = text.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

    // ✅ Frontmatter field check — warn but don't crash
    if (!text.includes('title:') || !text.includes('group:') || !text.includes('order:')) {
      console.warn('⚠️  Critic warning: frontmatter may be missing required fields');
    }

    console.log(`✨ Critic approved and polished the document!`);
    return text;

  } catch (error) {
    console.error("❌ Critic failed:", error);
    return draftMdx; // fallback — never break the build
  }
}

module.exports = editDocs;