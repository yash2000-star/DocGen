const express = require('express');
const fs = require('fs');
const path = require('path');
const { DIST_DIR, isSafeSegment } = require('../lib/paths');

const router = express.Router();

// Lists the published .mdx pages of a built site, in sidebar order when docs.json has one.
function publishedPages(siteDir) {
    const files = [];
    (function walk(dir, prefix) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
            else if (entry.name.endsWith('.mdx')) files.push(rel.slice(0, -4));
        }
    })(siteDir, '');

    let order = [];
    try {
        const docsJson = JSON.parse(fs.readFileSync(path.join(siteDir, 'docs.json'), 'utf8'));
        order = (docsJson.navigation || []).flatMap((group) => group.pages || []);
    } catch {
        // No docs.json: alphabetical order.
    }
    const rank = (slug) => { const i = order.indexOf(slug); return i === -1 ? Infinity : i; };
    return files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// Agent context for a docs site: the published pages as one text block. Only what's
// already public on the site is returned (never editor drafts).
router.get('/:tenant/:project', (req, res) => {
    const { tenant, project } = req.params;
    if (!isSafeSegment(tenant) || !isSafeSegment(project)) {
        return res.status(400).json({ error: 'Invalid project.' });
    }

    const siteDir = path.join(DIST_DIR, tenant, project);
    if (!fs.existsSync(siteDir)) {
        return res.status(404).json({ error: 'These docs have not been published.' });
    }

    try {
        const pages = publishedPages(siteDir);
        if (pages.length === 0) {
            return res.json({ project, agent_context: 'This documentation project is currently empty.' });
        }
        const agentContext = pages
            .map((slug) => `File: ${slug}\n\n${fs.readFileSync(path.join(siteDir, `${slug}.mdx`), 'utf8')}`)
            .join('\n\n---\n\n');
        res.json({ project, agent_context: agentContext });
    } catch (err) {
        console.error('MCP build context error:', err);
        res.status(500).json({ error: 'Failed to read the published docs.' });
    }
});

module.exports = router;
