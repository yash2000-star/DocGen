import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/auth";

export default function Analytics() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [views, setViews] = useState(0);
  const [visitors, setVisitors] = useState(0);
  // Reader feedback ("Was this page helpful?"), newest first.
  const [feedback, setFeedback] = useState([]);

  useEffect(() => {
    async function loadAnalytics() {
      setIsLoading(true);
      
      // 1. Get the project details
      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
        
      if (projData) {
        setProject(projData);
      }
      
      // 2. Fetch page views
      const { data: viewData, error } = await supabase
        .from('page_views')
        .select('visitor_session_id')
        .eq('project_id', id);
        
      if (viewData && !error) {
        setViews(viewData.length);
        const uniqueIds = new Set(viewData.map(v => v.visitor_session_id).filter(Boolean));
        setVisitors(uniqueIds.size);
      }
      
      const { data: feedbackData } = await supabase
        .from('page_feedback')
        .select('route, helpful, comment, created_at')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(500);
      setFeedback(feedbackData || []);

      setIsLoading(false);
    }
    
    loadAnalytics();
  }, [id]);

  if (!project && !isLoading) return <div style={{ padding: "40px" }}>Project not found.</div>;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "Inter, system-ui, -apple-system, sans-serif", paddingBottom: "60px" }}>
      
      <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 32px" }}>
        
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Analytics</h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
            Traffic for <strong style={{ color: "var(--text-heading)" }}>{project?.project_name || "..."}</strong> over the selected period.
          </p>
        </div>

        {/* 1. Controls Row */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
          {/* Left side (Tabs) */}
          <div style={{ backgroundColor: "#f8fafc", padding: "4px", borderRadius: "8px", display: "inline-flex", border: "1px solid #e2e8f0" }}>
            <button style={{ backgroundColor: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", color: "#0f172a", borderRadius: "6px", padding: "4px 12px", fontSize: "13px", border: "none", fontWeight: "500", cursor: "pointer" }}>Humans</button>
            <button style={{ backgroundColor: "transparent", color: "#64748b", padding: "4px 12px", fontSize: "13px", border: "none", fontWeight: "500", cursor: "pointer" }}>Agents</button>
          </div>

          {/* Right side (Date Picker) */}
          <button style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", fontSize: "13px", color: "#334155", backgroundColor: "#ffffff", cursor: "pointer", fontWeight: "500" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            Mar 20 - 27
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>

        {/* 2. Top Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", marginBottom: "24px" }}>
          {[
            { title: "Visitors", value: isLoading ? "..." : visitors },
            { title: "Views", value: isLoading ? "..." : views },
            { title: "Assistant", value: isLoading ? "..." : "0" },
            { title: "Searches", value: isLoading ? "..." : "0" },
            { title: "Feedback", value: isLoading ? "..." : feedback.length }
          ].map((stat, idx) => (
            <div key={idx} style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px" }}>
              <div style={{ fontSize: "13px", color: "#64748b", fontWeight: "500", marginBottom: "12px" }}>{stat.title}</div>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#0f172a", marginBottom: "4px" }}>{stat.value}</div>
              <div style={{ fontSize: "14px", color: "#94a3b8" }}>-</div>
            </div>
          ))}
        </div>

        {/* 3. Reader feedback by page */}
        <FeedbackSection feedback={feedback} isLoading={isLoading} />

        {/* 4. Fake Traffic Chart Area */}
        <div style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>Visitors Over Time</h4>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 24px 0" }}>Daily visitors count for the selected date range</p>
          
          <div style={{ height: "250px", borderBottom: "1px solid #e2e8f0", display: "flex", gap: "12px", alignItems: "flex-end", marginTop: "40px" }}>
            <div style={{ backgroundColor: "#10b981", borderRadius: "4px 4px 0 0", width: "48px", height: "250px" }}></div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FeedbackSection({ feedback, isLoading }) {
  const byPage = new Map();
  for (const item of feedback) {
    const row = byPage.get(item.route) || { route: item.route, yes: 0, no: 0 };
    if (item.helpful) row.yes += 1; else row.no += 1;
    byPage.set(item.route, row);
  }
  const rows = [...byPage.values()].sort((a, b) => (b.yes + b.no) - (a.yes + a.no));
  const comments = feedback.filter((item) => item.comment).slice(0, 20);
  const cell = { padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: "13px", color: "#334155", textAlign: "left" };

  return (
    <div data-testid="feedback-section" style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
      <h4 style={{ fontSize: "15px", fontWeight: "700", color: "#0f172a", margin: "0 0 4px 0" }}>Reader feedback</h4>
      <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 16px 0" }}>Answers to "Was this page helpful?" on your docs.</p>
      {isLoading ? <p style={{ fontSize: "13px", color: "#64748b" }}>Loading…</p> : rows.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>No feedback yet. Readers see the question at the bottom of every page.</p>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: comments.length ? "20px" : 0 }}>
            <thead><tr>{["Page", "Helpful", "Not helpful", "Score"].map((h) => <th key={h} style={{ ...cell, fontWeight: 600, color: "#64748b" }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.route}>
                  <td style={cell}><code>{row.route}</code></td>
                  <td style={cell}>{row.yes}</td>
                  <td style={cell}>{row.no}</td>
                  <td style={cell}>{Math.round((row.yes / (row.yes + row.no)) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {comments.length > 0 && (
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "8px" }}>Recent comments</div>
              {comments.map((item, i) => (
                <div key={i} style={{ padding: "10px 0", borderTop: "1px solid #f1f5f9", fontSize: "13px", color: "#334155" }}>
                  <span style={{ marginRight: "8px" }}>{item.helpful ? "👍" : "👎"}</span>
                  {item.comment}
                  <span style={{ color: "#94a3b8", marginLeft: "8px" }}>on <code>{item.route}</code></span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
