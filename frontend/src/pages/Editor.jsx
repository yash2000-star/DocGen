import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/auth";
import { apiFetch } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

function EditorHeader({ onPublish, disabled, viewMode, setViewMode }) {
  return (
    <div style={{ 
      display: "flex", alignItems: "center", justifyContent: "space-between", 
      height: "65px", padding: "0 24px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0",
      flexShrink: 0
    }}>
      {/* Left side: Icons */}
      <div style={{ display: "flex", gap: "20px", color: "#64748b" }}>
        <button onClick={() => setViewMode('preview')} style={{ background: "none", border: "none", cursor: "pointer", color: viewMode === 'preview' ? "#059669" : "inherit", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
        <button onClick={() => setViewMode('write')} style={{ background: "none", border: "none", cursor: "pointer", color: viewMode === 'write' ? "#059669" : "inherit", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
        </button>
      </div>

      {/* Middle: Git branch */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "500", color: "#334155", padding: "4px 10px", backgroundColor: "#f1f5f9", borderRadius: "6px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
        main
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
        </button>
        <button style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", alignItems: "center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <button 
          onClick={onPublish} 
          disabled={disabled}
          style={{ 
            padding: "6px 14px", backgroundColor: "#0f172a", color: "#ffffff", 
            border: "none", borderRadius: "6px", fontWeight: "500", fontSize: "13px", cursor: disabled ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", opacity: disabled ? 0.7 : 1
          }}
        >
          {disabled ? "Publishing..." : "Publish"}
        </button>
      </div>
    </div>
  );
}

export default function Editor() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  
  // The Brain's State
  const [pages, setPages] = useState([]);
  const [activePage, setActivePage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('write');

  // 1. Fetch Project and Pages
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      // Fetch Project
      const { data: projData } = await supabase.from('projects').select('*').eq('id', id).single();
      setProject(projData);

      // Fetch Pages
      const { data: pagesData, error } = await supabase
        .from('pages')
        .select('*')
        .eq('project_id', id)
        .order('order_index', { ascending: true });

      if (pagesData) {
        setPages(pagesData);
        if (pagesData.length > 0) setActivePage(pagesData[0]);
      }
      setIsLoading(false);
    }
    loadData();
  }, [id]);

  // 2. Handle Text Change
  function handleContentChange(e) {
    const newContent = e.target.value;
    // Update active page immediately for typing
    setActivePage({ ...activePage, content: newContent });
    // Update the pages array so we don't lose progress if clicking another tab
    setPages(pages.map(p => p.id === activePage.id ? { ...p, content: newContent } : p));
  }

  // 3. Create a New File
  async function createNewPage() {
    const title = prompt("Enter a title for your new page (e.g., Quickstart):");
    if (!title) return;

    // Convert "My File" to "my-file.mdx"
    const filePath = title.toLowerCase().replace(/\s+/g, '-') + '.mdx';

    const { data, error } = await supabase
      .from('pages')
      .insert({
        project_id: id,
        title: title,
        file_path: filePath,
        content: `# ${title}\n\nStart writing your markdown here...`,
        order_index: pages.length
      })
      .select()
      .single();

    if (error) {
      alert("Error creating page");
      console.error(error);
    } else {
      setPages([...pages, data]);
      setActivePage(data);
    }
  }

  // 4. Save to DB and Publish to Next.js Engine
  async function publishDoc() {
    if (!activePage) return;
    setSaving(true);
    
    try {
      // Step A: Save to Supabase 'pages' table first
      await supabase
        .from('pages')
        .update({ content: activePage.content })
        .eq('id', activePage.id);

      // Step B: Send to your static generator backend
      const res = await apiFetch(`/api/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              tenant: project.tenant_name,
              version: project.project_name,
              fileName: activePage.file_path.replace('.mdx', ''),
              content: activePage.content
          })
      });
      const data = await res.json().catch(() => ({}));
      // The server refuses pages with MDX syntax errors and says where the error is.
      if (!res.ok) throw new Error(data.error || "Failed to publish document.");
      alert("Saved & Published Successfully!");
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to publish document.");
    } finally {
      setSaving(false);
    }
  }

  if (!project) return <div style={{ padding: "40px", fontFamily: "system-ui" }}>Loading editor...</div>;

  return (
    <div style={{ position: "fixed", top: 0, left: "250px", right: 0, bottom: 0, backgroundColor: "#ffffff", zIndex: 100, display: "flex", flexDirection: "column", fontFamily: "Inter, system-ui, sans-serif" }}>
      
      <EditorHeader onPublish={publishDoc} disabled={saving} viewMode={viewMode} setViewMode={setViewMode} />

      {/* 3-Column Flex Layout Environment */}
      <div style={{ display: "flex", height: "calc(100vh - 65px)", overflow: "hidden" }}>
        
        {/* Middle Column (File Explorer) */}
        <div style={{ width: "260px", borderRight: "1px solid #e2e8f0", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          
          {/* Top Tabs */}
          <div style={{ display: "flex", alignItems: "flex-end", borderBottom: "1px solid #e2e8f0", padding: "0 16px" }}>
            <div style={{ padding: "12px 6px", fontSize: "13px", fontWeight: "600", color: "#0f172a", borderBottom: "2px solid #0f172a", cursor: "pointer", marginRight: "16px" }}>Navigation</div>
            <div style={{ padding: "12px 6px", fontSize: "13px", fontWeight: "500", color: "#64748b", cursor: "pointer", marginRight: "16px", borderBottom: "2px solid transparent" }}>Files</div>
            <div style={{ padding: "12px 6px", fontSize: "13px", fontWeight: "500", color: "#64748b", cursor: "pointer", borderBottom: "2px solid transparent" }}>Config</div>
          </div>

          {/* Dynamic File Tree */}
          <div style={{ padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px", flex: 1, overflowY: "auto" }}>
             
             {/* Folder */}
             <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "600", color: "#334155", padding: "6px 8px" }}>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#94a3b8" }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
               Documents
             </div>

             {isLoading ? (
               <div style={{ padding: "12px", fontSize: "13px", color: "#94a3b8" }}>Loading files...</div>
             ) : pages.length === 0 ? (
               <div style={{ padding: "12px", fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>No pages yet.</div>
             ) : (
               pages.map((page) => (
                 <div 
                   key={page.id}
                   onClick={() => setActivePage(page)}
                   style={{ 
                     display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", 
                     fontWeight: activePage?.id === page.id ? "600" : "500", 
                     color: activePage?.id === page.id ? "#059669" : "#64748b", 
                     backgroundColor: activePage?.id === page.id ? "#ecfdf5" : "transparent", 
                     padding: "6px 8px", cursor: "pointer", paddingLeft: "30px", borderRadius: "6px", marginTop: "2px" 
                   }}
                 >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                   {page.title}
                 </div>
               ))
             )}

             {/* Add New Button */}
             <div 
               onClick={createNewPage}
               style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontWeight: "500", color: "#64748b", padding: "8px", cursor: "pointer", marginTop: "12px", borderTop: "1px solid #e2e8f0" }}
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
               Add new
             </div>

          </div>
        </div>

        {/* Main Canvas (Right Column) */}
        <div style={{ flex: 1, backgroundColor: "#f8fafc", overflowY: "auto", position: "relative", padding: "32px" }}>
          
          <div style={{ 
            maxWidth: "800px", margin: "0 auto", backgroundColor: "#ffffff", 
            minHeight: "800px", padding: "48px", borderRadius: "12px", 
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)",
            border: "1px solid #e2e8f0"
          }}>
            {activePage ? (
              <>
                <h1 style={{ fontSize: "36px", fontWeight: "700", color: "#0f172a", marginTop: 0, marginBottom: "24px", letterSpacing: "-0.5px", outline: "none" }}>
                  {activePage.title}
                </h1>
                
                {viewMode === 'write' ? (
                  <textarea
                    style={{ 
                      width: "100%", minHeight: "500px", fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", 
                      fontSize: "15px", lineHeight: "1.7", border: "none", outline: "none", resize: "none", 
                      backgroundColor: "transparent", color: "#334155" 
                    }}
                    placeholder="Write your markdown here... Use standard syntax like # Headings, **bold**, and `code`."
                    value={activePage.content || ""}
                    onChange={handleContentChange}
                  />
                ) : (
                  <div className="prose max-w-none p-8" style={{ minHeight: "500px" }}>
                    <ReactMarkdown
                      components={{
                        code({node, inline, className, children, ...props}) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-md my-4"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-sm" {...props}>
                              {children}
                            </code>
                          )
                        },
                        blockquote({node, children, ...props}) {
                          return (
                            <blockquote className="border-l-4 border-emerald-500 bg-slate-50 text-slate-700 py-2 px-4 my-4 rounded-r-md italic" {...props}>
                              {children}
                            </blockquote>
                          )
                        }
                      }}
                    >
                      {activePage.content || ""}
                    </ReactMarkdown>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", color: "#94a3b8", marginTop: "100px", fontSize: "15px" }}>
                Select a file from the sidebar, or click "+ Add new" to create one.
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}