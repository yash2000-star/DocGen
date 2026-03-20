import { useState} from "react";
import ReactMarkdown from "react-markdown";
import { apiFetch } from '../lib/api';

export default function Editor() {
    const [tenant, setTenant] = useState("company-a");
    const [version, setVersion] = useState("v1");
    const [fileName, setFileName] = useState("");
    const [content, setContent] = useState("");

    async function publishDoc() {
        if (!fileName || !content) {
            alert ("Please provide a file name and some content");
            return;
        }
        const res = await apiFetch(`/api/docs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                tenant,
                version,
                fileName,
                content
            })
        });

        const data = await res.json();
        alert(data.message);
    }

   return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
      
      <div style={{ marginBottom: "20px", display: "flex", gap: "15px", backgroundColor: "#f8f9fa", padding: "15px", borderRadius: "8px", border: "1px solid #ddd" }}>
        <div>
            <label style={{ display: "block", fontSize: "12px", color: "#666" }}>Company / Tenant</label>
            <input value={tenant} onChange={(e) => setTenant(e.target.value)} style={{ padding: "5px" }} />
        </div>
        <div>
            <label style={{ display: "block", fontSize: "12px", color: "#666" }}>Version</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} style={{ padding: "5px", width: "80px" }} />
        </div>
        <div>
            <label style={{ display: "block", fontSize: "12px", color: "#666" }}>File Name (no .md)</label>
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} style={{ padding: "5px" }} placeholder="e.g. webhooks" />
        </div>
        <button 
            onClick={publishDoc} 
            style={{ marginLeft: "auto", padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
             Publish to Engine
        </button>
      </div>

      <div style={{ display: "flex", gap: "20px", flex: 1, minHeight: "500px" }}>
        
        {/* Editor Side */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Markdown Editor</h3>
          <textarea
            style={{ flex: 1, width: "100%", padding: "15px", fontFamily: "monospace", fontSize: "14px", border: "1px solid #ccc", borderRadius: "4px", resize: "none" }}
            placeholder="Write your markdown here... Use # for headings!"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* Live Preview Side */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Live Preview</h3>
          <div style={{ flex: 1, border: "1px solid #ccc", borderRadius: "4px", padding: "15px", backgroundColor: "#fff", overflowY: "auto" }}>
            
            {/* If content is empty, show a helper message. Otherwise, render the Markdown! */}
            {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
            ) : (
                <p style={{ color: "#aaa", fontStyle: "italic", marginTop: "0" }}>Your live preview will appear here...</p>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}