const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

router.get('/:tenant/:project', async (req, res) => {
    try {
        const { tenant, project } = req.params;

        // Query the specific project by tenant and version/name
        const { data: projectData, error: projError } = await supabase
            .from('projects')
            .select('id, project_name')
            .eq('tenant_name', tenant)
            .eq('project_name', project)
            .single();

        if (projError || !projectData) {
            return res.status(404).json({ error: 'Project context could not be located in database.' });
        }

        // Gather all attached semantic pages related to this project instance
        const { data: pages, error: pagesError } = await supabase
            .from('pages')
            .select('title, file_path, content')
            .eq('project_id', projectData.id)
            .order('order_index', { ascending: true });

        if (pagesError) {
            console.error(pagesError);
            return res.status(500).json({ error: 'Failed to extract MDX documents.' });
        }

        if (!pages || pages.length === 0) {
            return res.json({ 
                project: projectData.project_name, 
                agent_context: "This documentation project is currently empty." 
            });
        }

        // Model Context Protocol format - Raw AI Context Strings
        const agentContext = pages.map(page => {
            const fileName = page.title || page.file_path;
            const cleanContent = page.content || '';
            
            return `File: ${fileName}\n\n${cleanContent}`;
        }).join('\n\n---\n\n');

        // Respond precisely with requested raw payload
        res.json({
            project: projectData.project_name,
            agent_context: agentContext
        });

    } catch (err) {
        console.error("MCP build context error:", err);
        res.status(500).json({ error: 'System error mapping knowledge tree to AI context format.' });
    }
});

module.exports = router;
