import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/auth";
import { apiFetch } from '../lib/api';

// --- NEW IMPORTS: The MDX Engine! ---
import { evaluate } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import {
  Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip,
  Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField,
  ResponseField, Expandable, Frame, CodeGroup, Check, Update, Tooltip,
  RequestExample, ResponseExample, ApiPlayground, CodeGenerator
} from "../components/mdx/MdxComponents";

export default function Editor() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // --- NEW: State for Live Preview ---
  const [PreviewComponent, setPreviewComponent] = useState(() => () => null);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', id).single()
      .then(({ data }) => setProject(data));
  }, [id]);

  // --- NEW: The Live MDX Evaluator ---
  useEffect(() => {
    if (!content) {
       setPreviewComponent(() => () => null);
       setPreviewError(null);
       return;
    }

    const compileMdx = async () => {
      try {
        const { default: Compiled } = await evaluate(content, {
          ...runtime,
        });
        setPreviewComponent(() => Compiled);
        setPreviewError(null);
      } catch (err) {
        // Catches syntax errors (like unclosed tags) so the app doesn't crash!
        setPreviewError(err.message);
      }
    };

    // 300ms debounce so it doesn't crash while you are typing half a component
    const timeoutId = setTimeout(() => compileMdx(), 300);
    return () => clearTimeout(timeoutId);
  }, [content]);

  // The map of all your custom components
  const mdxComponents = {
    Note, Warning, Steps, Step, CodeBlock, Tabs, Tab, Card, CardGroup, Tip,
    Info, Danger, Accordion, AccordionGroup, Badge, Callout, ParamField,
    ResponseField, Expandable, Frame, CodeGroup, Check, Update, Tooltip,
    RequestExample, ResponseExample, ApiPlayground, CodeGenerator
  };

  async function publishDoc() {
    if (!fileName || !content) {
        alert("Please provide a file name and some content.");
        return;
    }
    
    setSaving(true);
    
    try {
      const res = await apiFetch(`/api/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
              tenant: project.tenant_name,
              version: project.project_name,
              fileName,
              content
          })
      });

      const data = await res.json();
      alert(data.message);
    } catch (err) {
      console.error(err);
      alert("Failed to publish document.");
    } finally {
      setSaving(false);
    }
  }

  if (!project) return <div style={{ padding: "40px", fontFamily: "system-ui" }}>Loading editor...</div>;

  return (
    <div style={{ paddingBottom: "60px", fontFamily: "system-ui, -apple-system, sans-serif", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 32px", width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Web Editor</h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
              Create or edit pages directly in the browser for <strong style={{color: "var(--text-heading)"}}>{project.project_name}</strong>.
            </p>
          </div>
          
          <button 
            onClick={publishDoc} 
            disabled={saving}
            style={{ 
              padding: "10px 20px", backgroundColor: "var(--text-heading)", color: "var(--bg-main)", 
              border: "none", borderRadius: "8px", fontWeight: "500", cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "8px", opacity: saving ? 0.7 : 1
            }}
          >
            {saving ? "Publishing..." : "Publish to Engine"}
            {!saving && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>}
          </button>
        </div>

        <div style={{ marginBottom: "24px", display: "flex", gap: "16px", backgroundColor: "var(--bg-main)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
          <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "var(--text-heading)", marginBottom: "8px" }}>File Path / Name (No .mdx needed)</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border-color)", borderRadius: "8px", overflow: "hidden" }}>
                <span style={{ padding: "10px 12px", backgroundColor: "#f8fafc", color: "var(--text-muted)", fontSize: "14px", borderRight: "1px solid var(--border-color)", fontFamily: "monospace" }}>
                  {project.tenant_name}/{project.project_name}/
                </span>
                <input 
                  value={fileName} 
                  onChange={(e) => setFileName(e.target.value)} 
                  style={{ flex: 1, padding: "10px 12px", border: "none", outline: "none", fontSize: "14px", fontFamily: "monospace", color: "var(--text-heading)" }} 
                  placeholder="e.g. guides/getting-started" 
                />
              </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "24px", flex: 1, minHeight: "500px" }}>
          
          <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", backgroundColor: "#f8fafc", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Markdown Source
            </div>
            <textarea
              style={{ flex: 1, width: "100%", padding: "20px", fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace", fontSize: "14px", lineHeight: "1.6", border: "none", outline: "none", resize: "none", backgroundColor: "transparent", color: "var(--text-heading)" }}
              placeholder="Write your markdown here...\n\n# Heading 1\n\nUse standard markdown syntax."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* --- UPDATED: The new Live Preview render logic --- */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", backgroundColor: "#f8fafc", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Live Preview
            </div>
            <div style={{ flex: 1, padding: "32px", overflowY: "auto", backgroundColor: "#ffffff" }}>
              {!content ? (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic" }}>
                    Your preview will appear here...
                  </div>
              ) : previewError ? (
                  <div style={{ color: "#ef4444", fontSize: "13px", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                    <strong>Syntax Error:</strong> {previewError}
                  </div>
              ) : (
                  <div className="mdx-content">
                     <PreviewComponent components={mdxComponents} />
                  </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}