const fs = require("fs");
const path = require("path");
const { title } = require("process");
const { unified } = require("unified");
const remarkParse = require("remark-parse").default;
const remarkRehype = require("remark-rehype").default;
const rehypeStringify = require("rehype-stringify").default;
const { visit } = require("unist-util-visit");
const GithubSlugger = require("github-slugger").default;
const matter = require("gray-matter");

//Embedding Tool
require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

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

async function build() {
  if (!fs.existsSync(DIST_PATH)) {
    fs.mkdirSync(DIST_PATH, { recursive: true });
  }

  const args = process.argv.slice(2);
  // Collect all arguments EXCEPT '--webhook' to get an array of specific files
  const targetRoutes = args.filter(arg => arg !== '--webhook');

  const scannedDocs = scanDocs(DOCS_PATH);
  const docs = [];
  const searchIndex = [];
  const aiChunks = [];

  for (const doc of scannedDocs) {
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

    // --- UPDATED: Pushing deep-linked sections into the index ---
    const sections = extractSearchSections(result.raw, title, doc.route, doc.tenant, doc.version);
    searchIndex.push(...sections);

    // If the array is empty, build everything. If it has files, ONLY build those files!
  const shouldGenerateVectors = targetRoutes.length === 0 || targetRoutes.includes(doc.route);

    // Chunking Engine
    if (shouldGenerateVectors) {
    const paragraphs = result.raw.split("\n\n");
    console.log(`Generating math vectors for: ${doc.route}.md...`);

    await supabase
      .from("doc_vectors")
      .delete()
      .eq("tenant", doc.tenant)
      .eq("version", doc.version)
      .eq("route", doc.route);

    const docVectorsToUpload = [];

    for (const para of paragraphs) {
      const cleanText = para.trim();

      if (cleanText.length > 20) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));

          const embedResult = await embeddingModel.embedContent(cleanText);
          const vectorArray = embedResult.embedding.values;

          const chunkData = {
            tenant: doc.tenant,
            version: doc.version,
            route: doc.route,
            text: cleanText,
            embedding: vectorArray,
          };

          docVectorsToUpload.push(chunkData);
          aiChunks.push(chunkData);
        } catch (error) {
          console.log(` Failed to generate embedding for ${doc.route}:`, error);
        }
      }
    }

    if (docVectorsToUpload.length > 0) {
      console.log(`Upload ${docVectorsToUpload.length} vectors to Supabase...`);
      const { error } = await supabase
        .from("doc_vectors")
        .insert(docVectorsToUpload);

      if (error) {
        console.error(` Supabase upload failed for ${doc.route}:`, error);
      } else {
        console.log(`Upload successful!`);
      }
    }
    } else {
      console.log(`⏩ Skipping expensive vector generation for: ${doc.route} (Unchanged)`);
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
      let destConfigPath = path.join(targetDir, "mint.json"); // Always output as mint.json for the frontend

      // Fallback to mint.json if docgen.json doesn't exist (e.g., imported from GitHub)
      if (!fs.existsSync(sourceConfigPath)) {
        sourceConfigPath = path.join(DOCS_PATH, tenant, version, "mint.json");
      }

      let siteConfig = { colors: { primary: "#3b82f6" } }; // Default fallback

      if (fs.existsSync(sourceConfigPath)) {
        try {
            const rawConfig = fs.readFileSync(sourceConfigPath, 'utf8');
            siteConfig = JSON.parse(rawConfig);
            fs.copyFileSync(sourceConfigPath, destConfigPath);
            console.log(`[Config] Loaded settings for ${tenant}/${version}`);
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

      // Save Ai chunks
      const localAiChunks = aiChunks
        .filter((item) => item.tenant === tenant && item.version === version)
        .map((item) => ({
          ...item,
          route: item.route.replace(`${tenant}/${version}/`, ""),
        }));

      fs.writeFileSync(
        path.join(targetDir, "aiChunks.json"),
        JSON.stringify(localAiChunks, null, 2),
      );
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

build();