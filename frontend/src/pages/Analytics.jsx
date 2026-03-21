import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/auth";
import Navbar from "../components/dashboard/Navbar";

export default function Analytics() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [usage, setUsage] = useState({ generations: 0, views: 1245, apiHits: 342 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      // 1. Get the project details
      const { data: projData } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
        
      if (projData) {
        setProject(projData);
        
        // 2. Fetch the real AI generation usage from the tracking table we saw in server.js
        const month = new Date().toISOString().slice(0, 7);
        const { data: usageData } = await supabase
          .from('usage_tracking')
          .select('generations')
          .eq('user_id', projData.user_id)
          .eq('month', month)
          .single();

        if (usageData) {
          setUsage(prev => ({ ...prev, generations: usageData.generations }));
        }
      }
      setLoading(false);
    }
    
    loadAnalytics();
  }, [id]);

  if (loading) return <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}><Navbar /></div>;
  if (!project) return <div style={{ padding: "40px" }}>Project not found.</div>;

  // Calculate percentage for the progress bar (assuming Free plan limit is 20)
  const limit = 20; 
  const percentUsed = Math.min((usage.generations / limit) * 100, 100);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: "60px" }}>
      <Navbar />
      
      <div style={{ maxWidth: "1000px", margin: "40px auto", padding: "0 32px" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "700", color: "var(--text-heading)", margin: "0 0 8px 0" }}>Analytics</h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
              Traffic and API usage for <strong style={{ color: "var(--text-heading)" }}>{project.project_name}</strong> over the last 30 days.
            </p>
          </div>
          <select style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "var(--bg-main)", color: "var(--text-heading)", outline: "none", cursor: "pointer" }}>
            <option>Last 30 Days</option>
            <option>Last 7 Days</option>
            <option>All Time</option>
          </select>
        </div>

        {/* Top Stat Cards (Bento Grid) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "24px" }}>
          
          {/* Card 1: Page Views */}
          <div style={{ backgroundColor: "var(--bg-main)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", marginBottom: "16px", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Total Page Views
            </div>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>{usage.views.toLocaleString()}</div>
            <div style={{ fontSize: "13px", color: "#16a34a", display: "flex", alignItems: "center", gap: "4px", fontWeight: "500" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              +14.2% from last month
            </div>
          </div>

          {/* Card 2: API Playground Hits */}
          <div style={{ backgroundColor: "var(--bg-main)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", marginBottom: "16px", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              API Tester Requests
            </div>
            <div style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-heading)", marginBottom: "8px" }}>{usage.apiHits.toLocaleString()}</div>
            <div style={{ fontSize: "13px", color: "#16a34a", display: "flex", alignItems: "center", gap: "4px", fontWeight: "500" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
              +5.8% from last month
            </div>
          </div>

          {/* Card 3: AI Generation Usage (Real Data) */}
          <div style={{ backgroundColor: "var(--bg-main)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text-muted)", marginBottom: "16px", fontSize: "13px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              AI Generations (Free Plan)
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "16px" }}>
              <span style={{ fontSize: "36px", fontWeight: "700", color: "var(--text-heading)" }}>{usage.generations}</span>
              <span style={{ fontSize: "16px", color: "var(--text-muted)", fontWeight: "500" }}>/ {limit}</span>
            </div>
            
            {/* Progress Bar */}
            <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden", marginTop: "auto" }}>
              <div style={{ 
                height: "100%", 
                width: `${percentUsed}%`, 
                backgroundColor: percentUsed > 90 ? "#ef4444" : percentUsed > 75 ? "#f59e0b" : "#3b82f6",
                transition: "width 1s ease-out"
              }}></div>
            </div>
          </div>

        </div>

        {/* Fake Traffic Chart Area */}
        <div style={{ backgroundColor: "var(--bg-main)", padding: "32px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: "0 0 24px 0", color: "var(--text-heading)" }}>Traffic Overview</h2>
          
          <div style={{ height: "250px", display: "flex", alignItems: "flex-end", gap: "12px", padding: "20px 0 0 0", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0", position: "relative" }}>
            {/* Generating some random CSS bars to look like a chart */}
            {[40, 65, 45, 80, 55, 90, 70, 100, 85, 110, 95, 120, 105, 130].map((height, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: "#eff6ff", borderTopLeftRadius: "4px", borderTopRightRadius: "4px", height: `${(height / 130) * 100}%`, position: "relative", group: "chart-bar" }}>
                 <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: "4px", backgroundColor: "#3b82f6", borderTopLeftRadius: "4px", borderTopRightRadius: "4px" }}></div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", color: "var(--text-muted)", fontSize: "12px", fontWeight: "500" }}>
            <span>Mar 1</span>
            <span>Mar 15</span>
            <span>Mar 30</span>
          </div>
        </div>

      </div>
    </div>
  );
}