const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DOCS_PATH = path.join(PROJECT_ROOT, 'docs');
const DIST_PATH = path.join(PROJECT_ROOT, 'dist');
const WELL_KNOWN_DIR = path.join(PROJECT_ROOT, '.well-known', 'skills', 'default');
const LLMS_OUTPUT_PATH = path.join(PROJECT_ROOT, '.well-known', 'llms.txt');
const SKILL_OUTPUT_PATH = path.join(WELL_KNOWN_DIR, 'skill.md');
const USER_OVERRIDE_PATH = path.join(PROJECT_ROOT, 'skill.md');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'docs.json');

/**
 * Recursively scans a directory for .md and .mdx files.
 * Returns an array of { relativePath, title } objects.
 */
function scanMarkdownFiles(dir, basePath = '') {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(basePath, entry.name);

    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files = files.concat(scanMarkdownFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      // Extract the first heading as title
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : entry.name.replace(/\.(md|mdx)$/, '');
        files.push({
          relativePath: relPath.replace(/\\/g, '/'),
          title,
          size: content.length,
        });
      } catch (e) {
        files.push({
          relativePath: relPath.replace(/\\/g, '/'),
          title: entry.name.replace(/\.(md|mdx)$/, ''),
          size: 0,
        });
      }
    }
  }

  return files;
}

/**
 * Reads docs.json and returns the parsed config.
 * Returns a minimal default if the file doesn't exist.
 */
function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { name: 'DocGen Platform', colors: { primary: '#3b82f6' }, navigation: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return { name: 'DocGen Platform', colors: { primary: '#3b82f6' }, navigation: [] };
  }
}

/**
 * Generates the skill.md content as a string.
 */
function buildSkillContent(config, docFiles, distFiles) {
  const siteName = config.name || 'DocGen Documentation Platform';
  const primaryColor = config.colors?.primary || '#3b82f6';
  const now = new Date().toISOString();

  // Build navigation table
  let navTable = '| # | Group | Items |\n|---|-------|-------|\n';
  if (config.navigation && Array.isArray(config.navigation) && config.navigation.length > 0) {
    config.navigation.forEach((nav, i) => {
      const group = typeof nav === 'string' ? nav : (nav.group || nav.title || 'Untitled');
      const items = nav.pages ? nav.pages.length : '-';
      navTable += `| ${i + 1} | ${group} | ${items} |\n`;
    });
  } else {
    navTable += '| - | No navigation configured yet | - |\n';
  }

  // Build file listing table
  let fileTable = '| File | Title | Size |\n|------|-------|------|\n';
  const allFiles = [...docFiles, ...distFiles];
  if (allFiles.length > 0) {
    // Show at most 30 files to keep the skill.md reasonable
    const filesToShow = allFiles.slice(0, 30);
    filesToShow.forEach(f => {
      const sizeKb = f.size > 0 ? `${(f.size / 1024).toFixed(1)} KB` : '-';
      fileTable += `| \`${f.relativePath}\` | ${f.title} | ${sizeKb} |\n`;
    });
    if (allFiles.length > 30) {
      fileTable += `| ... | _${allFiles.length - 30} more files_ | - |\n`;
    }
  } else {
    fileTable += '| - | No documentation files found | - |\n';
  }

  return `---
name: ${siteName}
description: AI-readable skill file for the ${siteName} documentation platform
generated: ${now}
---

# ${siteName}

This is an auto-generated skill file describing the documentation site powered by **DocGen** — an open-source Mintlify clone built with Node.js.

## About This Site

- **Platform**: DocGen (Mintlify-compatible)
- **Primary Brand Color**: \`${primaryColor}\`
- **Theme**: ${config.theme || 'mint'}
- **Total Documentation Files**: ${allFiles.length}

## Navigation Structure

${navTable}

## Documentation Files

${fileTable}

## Available MDX Components

This documentation platform supports the following custom MDX components that can be used inside \`.md\` and \`.mdx\` files:

| Component | Usage | Description |
|-----------|-------|-------------|
| \`<Accordion>\` | \`<Accordion title="FAQ">\` | Collapsible content sections |
| \`<AccordionGroup>\` | \`<AccordionGroup>\` | Groups multiple accordions |
| \`<Card>\` | \`<Card title="Feature" icon="⚡">\` | Feature/info cards |
| \`<CardGroup>\` | \`<CardGroup cols={3}>\` | Grid layout for cards |
| \`<Tabs>\` / \`<Tab>\` | \`<Tabs><Tab title="JS">\` | Tabbed content panels |
| \`<CodeBlock>\` | \`<CodeBlock language="js" title="example">\` | Syntax-highlighted code with copy button |
| \`<CodeGroup>\` | \`<CodeGroup>\` | Tabbed code blocks (multi-language) |
| \`<Steps>\` / \`<Step>\` | \`<Steps><Step title="Install">\` | Numbered step-by-step guides |
| \`<Note>\` | \`<Note>\` | Blue info callout |
| \`<Warning>\` | \`<Warning>\` | Amber warning callout |
| \`<Tip>\` | \`<Tip>\` | Green tip callout |
| \`<Info>\` | \`<Info>\` | Gray informational callout |
| \`<Danger>\` | \`<Danger>\` | Red danger callout |
| \`<Callout>\` | \`<Callout title="Note" icon="💡">\` | Generic callout with custom icon & color |
| \`<Badge>\` | \`<Badge type="success">NEW</Badge>\` | Inline label badges |
| \`<Frame>\` | \`<Frame caption="Screenshot">\` | Image frame with caption |
| \`<Expandable>\` | \`<Expandable title="Details">\` | Expandable content block |
| \`<ParamField>\` | \`<ParamField body name="id" type="string" required>\` | API parameter documentation |
| \`<ResponseField>\` | \`<ResponseField name="data" type="object">\` | API response field documentation |
| \`<ApiPlayground>\` | \`<ApiPlayground method="GET" endpoint="/users">\` | Interactive API testing |
| \`<CodeGenerator>\` | \`<CodeGenerator method="POST" endpoint="/auth">\` | Auto-generated code snippets (cURL, JS, Python) |

## Best Practices

1. **File Organization**: Place documentation files in \`/docs/{tenant}/{project}/\` following the tenant/project structure
2. **Frontmatter**: Use YAML frontmatter for metadata: \`title\`, \`order\`, \`group\`
3. **Navigation**: Define sidebar order in \`docs.json\` under the \`navigation\` array
4. **Theming**: Set brand colors in \`docs.json\` under \`colors.primary\`
5. **Search**: All content is automatically indexed for full-text search
6. **AI Context**: Use the MCP endpoint (\`/api/mcp/:tenant/:project\`) to let AI agents read your docs
7. **Code Blocks**: Always specify the language for syntax highlighting: \`\`\`javascript

## Key Configuration Options

The \`docs.json\` file supports these key fields:

| Field | Type | Description |
|-------|------|-------------|
| \`name\` | string | Site/project display name |
| \`colors.primary\` | string | Primary brand color (hex) |
| \`logo.light\` / \`logo.dark\` | string | Logo paths for light/dark mode |
| \`navigation\` | array | Sidebar navigation structure |
| \`tabs\` | array | Top-level navigation tabs |
| \`topbarCtaButton\` | object | Call-to-action button in topbar |
| \`footerSocials\` | object | Social links in footer |
| \`modeToggle\` | object | Light/dark mode toggle config |
| \`api.baseUrl\` | string | Base URL for API playground |
| \`api.auth\` | object | Authentication method config |
| \`analytics\` | object | PostHog, GA4, Amplitude keys |
| \`search.prompt\` | string | Custom search placeholder text |
| \`metadata\` | object | OpenGraph meta tags |
`;
}

/**
 * Generates the llms.txt content as a string.
 */
function buildLlmsContent(config, docFiles, distFiles) {
  const siteName = config.name || 'DocGen Documentation Platform';
  let content = `# ${siteName}\n\n`;
  content += `> This directory acts as a map for AI agents to understand what content exists on this site.\n\n`;
  content += `## Documentation Directory\n\n`;

  const allFiles = [...docFiles, ...distFiles];
  if (allFiles.length > 0) {
    allFiles.forEach(f => {
      // f.relativePath looks like "tenant/project/section/file"
      const urlPath = f.relativePath.replace(/\.(md|mdx)$/, '');
      content += `- [${f.title}](/docs/${urlPath})\n`;
    });
  } else {
    content += `No documentation files found.\n`;
  }

  return content;
}

/**
 * Main entry point: generates skill.md.
 * If a user-created skill.md exists at the project root, that takes priority.
 */
function generateSkill() {
  // Check for user override first
  if (fs.existsSync(USER_OVERRIDE_PATH)) {
    console.log('[Skill] User override found at /skill.md — using that instead of auto-generating.');
    
    // Ensure the .well-known directory exists
    fs.mkdirSync(WELL_KNOWN_DIR, { recursive: true });
    
    // Copy the user's file to the .well-known location
    fs.copyFileSync(USER_OVERRIDE_PATH, SKILL_OUTPUT_PATH);
    return SKILL_OUTPUT_PATH;
  }

  // Auto-generate
  console.log('[Skill] Auto-generating skill.md...');

  const config = readConfig();
  const docFiles = scanMarkdownFiles(DOCS_PATH);
  const distFiles = scanMarkdownFiles(DIST_PATH);

  const content = buildSkillContent(config, docFiles, distFiles);
  const llmsContent = buildLlmsContent(config, docFiles, distFiles);

  // Ensure the output directory exists
  fs.mkdirSync(WELL_KNOWN_DIR, { recursive: true });
  fs.writeFileSync(SKILL_OUTPUT_PATH, content, 'utf8');

  // Also write the llms.txt index file
  const rootWellKnownDir = path.dirname(LLMS_OUTPUT_PATH);
  if (!fs.existsSync(rootWellKnownDir)) {
      fs.mkdirSync(rootWellKnownDir, { recursive: true });
  }
  fs.writeFileSync(LLMS_OUTPUT_PATH, llmsContent, 'utf8');

  console.log(`[Skill] Generated skill.md at: ${SKILL_OUTPUT_PATH}`);
  console.log(`[Skill] Found ${docFiles.length} doc files + ${distFiles.length} dist files.`);

  return SKILL_OUTPUT_PATH;
}

/**
 * Returns the index.json manifest for the .well-known endpoint.
 */
function getSkillIndex() {
  return {
    skills: [
      {
        id: "default",
        name: "Documentation Platform Skill",
        description: "Describes the DocGen documentation platform, its components, navigation, and configuration.",
        path: "/.well-known/skills/default/skill.md",
        format: "markdown",
        version: "1.0.0",
        generated: new Date().toISOString()
      }
    ]
  };
}

module.exports = { generateSkill, getSkillIndex };
