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

function extractSearchContent(markdown) {
  return markdown
    .replace(/[#`>*\-]/g, "")
    .replace(/\n/g, " ")
    .toLowerCase();
}

async function build() {
  if (!fs.existsSync(DIST_PATH)) {
    fs.mkdirSync(DIST_PATH, { recursive: true });
  }

  const args = process.argv.slice(2);
  const targetRoute = args.length > 0 && args[0] !== '--webhook' ? args[0] : null;
  const isWebhook = args.includes('--webhook');

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
    });

    const searchContent = extractSearchContent(result.raw);
    searchIndex.push({
      title,
      route: doc.route,
      content: searchContent,
      tenant: doc.tenant,
      version: doc.version,
    });

    const shouldGenerateVectors = !targetRoute || doc.route === targetRoute || isWebhook;

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

      const sidebar = generateSidebarTree(cleanDocs);

      const targetDir = path.join(DIST_PATH, tenant, version);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Save Sidebar
      fs.writeFileSync(
        path.join(targetDir, "sidebar.json"),
        JSON.stringify(sidebar, null, 2),
      );

      const sourceConfigPath = path.join(DOCS_PATH, tenant, version, "mint.json");
      const destConfigPath = path.join(targetDir, "mint.json");

      if (fs.existsSync(sourceConfigPath)) {
        fs.copyFileSync(sourceConfigPath, destConfigPath);
        console.log(`Copied mint.json for ${tenant}/${version}`);
      } else {
        const defaultConfig = { colors: {primary: "#3b82f6"} };
        fs.writeFileSync(destConfigPath, JSON.stringify(defaultConfig, null, 2));
      }

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

function generateSidebarTree(docs) {
  const tree = [];

  for (const doc of docs) {
    const parts = doc.route.split("/");
    let currentLevel = tree;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (i === parts.length - 1) {
        currentLevel.push({
          title: doc.title,
          route: doc.route,
        });
      } else {
        let existing = currentLevel.find(
          (item) =>
            item.title.toLowerCase() === part.toLowerCase() && item.children,
        );

        if (!existing) {
          existing = {
            title: part.charAt(0).toUpperCase() + part.slice(1),
            children: [],
          };
          currentLevel.push(existing);
        }

        currentLevel = existing.children;
      }
    }
  }

  return tree;
}

build();
