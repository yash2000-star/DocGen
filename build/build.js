const fs = require("fs");
const path = require("path");
const { unified } = require("unified");
const remarkParse = require("remark-parse").default;
const remarkRehype = require("remark-rehype").default;
const rehypeStringify = require("rehype-stringify").default;
const { visit } = require("unist-util-visit");
const GithubSlugger = require("github-slugger").default;
const matter = require("gray-matter");

// Ask AI search index (Postgres full-text search, no AI calls needed)
const supabase = require("../backend/lib/supabase");

// Longest chunk stored for Ask AI; longer sections are split.
const MAX_CHUNK_CHARS = 4000;

const DOCS_PATH = path.join(__dirname, "../docs");
const DIST_PATH = path.join(__dirname, "../dist");

function scanDocs(dir, baseUrl = "") {
  const items = fs.readdirSync(dir);
  let results = [];

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const nested = scanDocs(fullPath, path.join(baseUrl, item));
      results = results.concat(nested);
    } else if (item.endsWith(".md") || item.endsWith(".mdx")) { 
      const extension = item.endsWith(".mdx") ? ".mdx" : ".md";
      const rawRoute = path.join(baseUrl, item.replace(extension, ""));
      const cleanRoute = rawRoute.replace(/\\/g, "/");

      const parts = cleanRoute.split("/");

      if (parts.length < 2) {
        console.log(
          `⚠️ WARNING: Ignoring stray file [${cleanRoute}.md]. It is not inside a tenant/version folder!`,
        );
        continue;
      }

      const tenant = parts[0];
      const version = parts[1];

      results.push({
        filePath: fullPath,
        route: cleanRoute,
        tenant: tenant,
        version: version,
      });
    }
  }
  return results;
}

function addHeadingIds() {
  const slugger = new GithubSlugger();

  return (tree) => {
    visit(tree, "heading", (node) => {
      const text = node.children
        .filter((child) => child.type === "text")
        .map((child) => child.value)
        .join("");

      const id = slugger.slug(text);

      node.data = node.data || {};
      node.data.hProperties = node.data.hProperties || {};
      node.data.hProperties.id = id;
    });
  };
}

async function convertMarkdownToHTML(filePath) {
  const markdown = fs.readFileSync(filePath, "utf-8");

  const parsed = matter(markdown);
  const content = parsed.content;
  const data = parsed.data;

  const file = await unified()
    .use(remarkParse)
    .use(addHeadingIds)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(content);

  return {
    html: String(file),
    raw: content,
    meta: data,
  };
}

function extractTitle(markdown) {
  const lines = markdown.split("\n");

  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.replace("#", "").trim();
    }
  }

  return "Untitled";
}

function extractHeadings(markdown) {
  const lines = markdown.split("\n");
  const headings = [];
  const slugger = new GithubSlugger();

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("#")) {
      const level = trimmed.match(/^#+/)[0].length;
      const text = trimmed.replace(/^#+\s*/, "");
      const id = slugger.slug(text);

      headings.push({
        level,
        text,
        id,
      });
    }
  }
  return headings;
}

// --- NEW SAAS-TIER SEARCH EXTRACTOR ---
function extractSearchSections(markdown, fileTitle, route, tenant, version) {
  const slugger = new GithubSlugger();
  const lines = markdown.split("\n");
  const sections = [];

  let currentHeading = null;
  let currentId = null;
  let currentContent = [];
  let fileIntroContent = [];

  for (const line of lines) {
    if (line.trim().startsWith("#")) {
      // Save the previous section
      if (currentHeading) {
        const cleanText = currentContent.join(" ").replace(/[#`>*\-]/g, "").trim();
        if (cleanText.length > 5) {
          sections.push({
            title: `${fileTitle} > ${currentHeading}`,
            route: `${route}#${currentId}`, // Appends the hash for deep linking!
            content: cleanText,
            tenant,
            version
          });
        }
      } else {
        fileIntroContent = [...currentContent];
      }

      // Start new section
      currentHeading = line.replace(/^#+\s*/, "").trim();
      currentId = slugger.slug(currentHeading);
      currentContent = [];
    } else {
      currentContent.push(line.trim());
    }
  }

  // Push the very last section
  if (currentHeading) {
    const cleanText = currentContent.join(" ").replace(/[#`>*\-]/g, "").trim();
    if (cleanText.length > 5) {
      sections.push({
        title: `${fileTitle} > ${currentHeading}`,
        route: `${route}#${currentId}`,
        content: cleanText,
        tenant,
        version
      });
    }
  } else {
    fileIntroContent = [...currentContent];
  }

  // Push the root file as well
  sections.push({
    title: fileTitle,
    route: route,
    content: fileIntroContent.join(" ").replace(/[#`>*\-]/g, "").trim(),
    tenant,
    version
  });

  return sections;
}

// Splits a page into one chunk per heading section, keeping the raw markdown (code
// samples included) because Ask AI quotes from it. Long sections are split further.
function extractChunks(markdown, fileTitle, route) {
  const slugger = new GithubSlugger();
  const chunks = [];
  let heading = null;
  let anchor = null;
  let lines = [];

  const flush = () => {
    const text = lines.join("\n").trim();
    if (text.length > 20) {
      const title = heading ? `${fileTitle} > ${heading}` : fileTitle;
      const chunkRoute = anchor ? `${route}#${anchor}` : route;
      for (let start = 0; start < text.length; start += MAX_CHUNK_CHARS) {
        chunks.push({ route: chunkRoute, title, text: text.slice(start, start + MAX_CHUNK_CHARS) });
      }
    }
    lines = [];
  };

  let inCodeBlock = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) inCodeBlock = !inCodeBlock;
    // A "#" inside a code block is a comment, not a heading.
    if (!inCodeBlock && /^#{1,6}\s/.test(line.trim())) {
      flush();
      heading = line.trim().replace(/^#+\s*/, "");
      anchor = slugger.slug(heading);
    } else {
      lines.push(line);
    }
  }
  flush();
  return chunks;
}

// Replaces a project's Ask AI chunks with the ones from this build.
async function replaceChunks(tenant, version, chunks) {
  const { error: deleteError } = await supabase
    .from("doc_chunks")
    .delete()
    .eq("tenant", tenant)
    .eq("version", version);
  if (deleteError) throw new Error(`Couldn't clear old search chunks: ${deleteError.message}`);

  for (let i = 0; i < chunks.length; i += 500) {
    const { error } = await supabase.from("doc_chunks").insert(chunks.slice(i, i + 500));
    if (error) throw new Error(`Couldn't save search chunks: ${error.message}`);
  }
  console.log(`[Search] Indexed ${chunks.length} sections for ${tenant}/${version}.`);
}

async function build() {
  if (!fs.existsSync(DIST_PATH)) {
    fs.mkdirSync(DIST_PATH, { recursive: true });
  }

  const args = process.argv.slice(2);
const scopeIndex = args.indexOf('--scope');
const targetScope = scopeIndex !== -1 ? args[scopeIndex + 1] : null;

let buildDir = DOCS_PATH;
if (targetScope) {
    // If Express told us to build a specific project, ONLY look in that folder!
    buildDir = path.join(DOCS_PATH, targetScope);
    console.log(`\n[Worker] 🎯 Scoped build active. Only building: ${targetScope}`);
} else {
    // Fallback just in case we run it manually
    console.log(`\n[Worker] ⚠️ Global build active. Rebuilding EVERYTHING.`);
}

// 3. Make sure the folder actually exists before we try to read it
if (!fs.existsSync(buildDir)) {
    console.error(`[Worker] Error: The directory ${buildDir} does not exist.`);
    process.exit(1);
}

// 4. Run the scanner ONLY on the targeted directory
// We pass targetScope so the URL routes stay correct (e.g., yash2000-star/to-do-list/...)
// 4. Run the scanner ONLY on the targeted directory
console.log(`[Worker] Scanning files in: ${buildDir}`);

// We assign this directly to scannedDocs so it only scans the scoped folder!
const scannedDocs = scanDocs(buildDir, targetScope ? `${targetScope}/` : "");
const docs = [];
  const searchIndex = [];
  const aiChunks = [];

  for (const doc of scannedDocs) {
    // --- THE OVERACHIEVER STOPPER ---
    // If a scope is provided, completely ignore files outside of it!
    if (targetScope && !doc.route.startsWith(targetScope)) {
        continue; 
    }

    const result = await convertMarkdownToHTML(doc.filePath);
    const title = result.meta.title || extractTitle(result.raw);
    const order = result.meta.order || 999;

    const headings = extractHeadings(result.raw);
    docs.push({
      route: doc.route,
      html: result.html,
      title,
      order,
      tenant: doc.tenant,
      version: doc.version,
      group: result.meta.group || "Miscellaneous",
    });

    const sections = extractSearchSections(result.raw, title, doc.route, doc.tenant, doc.version);
    searchIndex.push(...sections);

    // Ask AI searches these sections by keyword.
    const relativeRoute = doc.route.replace(`${doc.tenant}/${doc.version}/`, "");
    for (const chunk of extractChunks(result.raw, title, relativeRoute)) {
      aiChunks.push({ tenant: doc.tenant, version: doc.version, ...chunk });
    }

    const outputPath = path.join(DIST_PATH, doc.route + ".mdx");
    const outputDir = path.dirname(outputPath);

    fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(outputPath, result.raw);

    const toDir = path.join(DIST_PATH, "toc");
    fs.mkdirSync(toDir, { recursive: true });

    const tocFile = path.join(toDir, doc.route.replaceAll("/", "_") + ".json");

    fs.writeFileSync(tocFile, JSON.stringify(headings, null, 2));
  }

  docs.sort((a, b) => a.order - b.order);

  const tenants = [...new Set(docs.map((doc) => doc.tenant))];

  for (const tenant of tenants) {
    const tenantDocs = docs.filter((doc) => doc.tenant === tenant);

    const versions = [...new Set(tenantDocs.map((doc) => doc.version))];

    for (const version of versions) {
      const versionDocs = tenantDocs.filter((doc) => doc.version === version);

      const cleanDocs = versionDocs.map((doc) => ({
        ...doc,
        route: doc.route.replace(`${tenant}/${version}/`, ""),
      }));

      const targetDir = path.join(DIST_PATH, tenant, version);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

     // --- UPDATED: Smart Config Resolver ---
      let sourceConfigPath = path.join(DOCS_PATH, tenant, version, "docgen.json");
      let destConfigPath = path.join(targetDir, "docs.json"); // Always output as docs.json for the frontend

      // Fallback chain: docgen.json → docs.json → mint.json (backwards compat)
      if (!fs.existsSync(sourceConfigPath)) {
        sourceConfigPath = path.join(DOCS_PATH, tenant, version, "docs.json");
      }
      if (!fs.existsSync(sourceConfigPath)) {
        sourceConfigPath = path.join(DOCS_PATH, tenant, version, "mint.json");
      }

      // Deep merge utility: user values always win over defaults
      function deepMerge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
          } else if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
            // Only overwrite defaults with non-empty user values
            result[key] = source[key];
          } else if (!(key in result)) {
            result[key] = source[key];
          }
        }
        return result;
      }

      // Full extended schema as default fallback
      const defaultConfig = {
        "$schema": "https://mintlify.com/docs.json",
        name: "",
        logo: { light: "/logo/light.svg", dark: "/logo/dark.svg" },
        favicon: "/favicon.png",
        colors: { primary: "#3b82f6", light: "#ffffff", dark: "#000000" },
        theme: "mint",
        navigation: [],
        tabs: [],
        anchors: [],
        topbarLinks: [],
        topbarCtaButton: { name: "", url: "" },
        footerSocials: { github: "", twitter: "", linkedin: "" },
        backgroundImage: "",
        modeToggle: { default: "light", isHidden: false },
        api: { baseUrl: "", auth: { method: "bearer", name: "" } },
        analytics: { posthog: { apiKey: "" }, ga4: { measurementId: "" }, amplitude: { apiKey: "" } },
        search: { prompt: "Search documentation..." },
        metadata: { "og:title": "", "og:description": "", "og:image": "" }
      };

      let siteConfig = { ...defaultConfig };

      if (fs.existsSync(sourceConfigPath)) {
        try {
            const rawConfig = fs.readFileSync(sourceConfigPath, 'utf8');
            const userConfig = JSON.parse(rawConfig);
            // Deep merge: defaults + user config (user values always win)
            siteConfig = deepMerge(defaultConfig, userConfig);
            fs.writeFileSync(destConfigPath, JSON.stringify(siteConfig, null, 2));
            console.log(`[Config] Loaded and merged settings for ${tenant}/${version}`);
        } catch (e) {
            console.error(`[Config] Error parsing config for ${tenant}/${version}:`, e);
            fs.writeFileSync(destConfigPath, JSON.stringify(siteConfig, null, 2));
        }
      } else {
        fs.writeFileSync(destConfigPath, JSON.stringify(siteConfig, null, 2));
      }

      // --- UPDATED: Pass config to Sidebar Generator ---
      const sidebar = generateSidebarTree(cleanDocs, siteConfig);

      // Save Sidebar
      fs.writeFileSync(
        path.join(targetDir, "sidebar.json"),
        JSON.stringify(sidebar, null, 2),
      );

      const localSearchIndex = searchIndex
        .filter((item) => item.tenant === tenant && item.version === version)
        .map((item) => ({
          ...item,
          route: item.route.replace(`${tenant}/${version}/`, ""),
        }));

      fs.writeFileSync(
        path.join(targetDir, "search-index.json"),
        JSON.stringify(localSearchIndex, null, 2),
      );

      // Save Ai chunks (also published as aiChunks.json for agents)
      const localAiChunks = aiChunks.filter((item) => item.tenant === tenant && item.version === version);

      fs.writeFileSync(
        path.join(targetDir, "aiChunks.json"),
        JSON.stringify(localAiChunks, null, 2),
      );

      await replaceChunks(tenant, version, localAiChunks);
    }
  }

  console.log("Build completed successfully.");
}

// --- UPDATED: Dynamic Sidebar Generator ---
function generateSidebarTree(docs, config) {
  const tree = [];
  
  // Group all documents by their AI-assigned frontmatter group
  const groupedDocs = docs.reduce((acc, doc) => {
    const groupName = doc.group || "Miscellaneous";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(doc);
    return acc;
  }, {});

  // Dynamically get all the groups that were actually found in the documents
  let categoryOrder = Object.keys(groupedDocs);

  // Future-proofing: If the user defines a custom navigation order in their dashboard/config, use it!
  if (config && config.navigation && Array.isArray(config.navigation)) {
    // Only use config categories if they actually match our data structure for now
    const configCategories = config.navigation.map(nav => typeof nav === 'string' ? nav : nav.group);
    if (configCategories.length > 0) {
        // Merge them: Put configured categories first, then append any unconfigured ones
        const unconfigured = categoryOrder.filter(c => !configCategories.includes(c));
        categoryOrder = [...configCategories, ...unconfigured];
    }
  }

  // Build the Mintlify-style array based on the dynamic categories
  categoryOrder.forEach(category => {
    if (groupedDocs[category] && groupedDocs[category].length > 0) {
      tree.push({
        title: category,
        children: groupedDocs[category].map(doc => ({
          title: doc.title,
          route: doc.route
        }))
      });
    }
  });

  return tree;
}

build().catch((error) => {
  console.error(`[Worker] Build failed: ${error.message}`);
  process.exit(1);
});
