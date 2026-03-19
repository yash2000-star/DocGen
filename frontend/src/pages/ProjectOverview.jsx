import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "../lib/auth";
import { updateProjectStatus } from "../lib/projects";
import Navbar from "../components/dashboard/Navbar";
import { getGreeting } from "../lib/utils";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";

const statusColors = {
  live:       { bg: '#ecfdf5', color: '#059669', label: 'Live' },
  successful: { bg: '#ecfdf5', color: '#059669', label: 'Live' }, // Maps backend success to 'Live' UI
  running:    { bg: '#fffbeb', color: '#d97706', label: 'Building' }, // Maps backend running to 'Building' UI
  building:   { bg: '#fffbeb', color: '#d97706', label: 'Building' },
  failed:     { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
  pending:    { bg: '#f1f5f9', color: '#64748b', label: 'Pending' },
};

function PreviewUnavailable({ status }) {
  return (
    <div style={{ 
      height: '100%', minHeight: '400px', backgroundColor: '#fafafa', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      position: 'relative', overflow: 'hidden' 
    }}>
      {/* Mintlify-Style Background Skeleton SVG */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.6 }} xmlns="http://www.w3.org/2000/svg">
        {/* Fake Sidebar */}
        <rect x="0" y="0" width="25%" height="100%" fill="#f1f5f9" />
        <rect x="20" y="30" width="15%" height="12" rx="4" fill="#e2e8f0" />
        <rect x="20" y="60" width="18%" height="8" rx="4" fill="#e2e8f0" />
        <rect x="20" y="80" width="12%" height="8" rx="4" fill="#e2e8f0" />
        {/* Fake Content Area */}
        <rect x="30%" y="30" width="40%" height="20" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="80" width="60%" height="10" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="110" width="55%" height="10" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="140" width="45%" height="10" rx="4" fill="#f1f5f9" />
      </svg>

      {/* Floating Badge */}
      <div style={{ 
        backgroundColor: 'white', padding: '8px 16px', borderRadius: '20px', 
        border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', 
        zIndex: 10, fontSize: '13px', color: '#64748b', fontWeight: 500 
      }}>
        {status === 'building' ? (
          <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
            Building preview...
          </span>
        ) : 'Preview unavailable'}
      </div>
    </div>
  );
}

function ActionButtons({ project, onRebuild }) {
  const [copied, setCopied] = useState(false);
  const deployUrl = `https://${project.project_name}.docgen.app`; 

  const handleCopy = () => {
    navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  };

  const btnStyle = { padding: "8px", backgroundColor: "white", border: "1px solid var(--border-color)", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", transition: "all 0.2s" };

  return (
    <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
      <button onClick={handleCopy} style={btnStyle} title="Copy URL">
        {copied ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        )}
      </button>
      
      <button onClick={onRebuild} disabled={project.status === 'building'} style={{...btnStyle, opacity: project.status === 'building' ? 0.5 : 1}} title="Rebuild docs">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: project.status === 'building' ? 'spin 1s linear infinite' : 'none' }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </button>
      
      <button onClick={() => window.open(deployUrl, '_blank')} style={btnStyle} title="Visit site">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </button>
    </div>
  );
}

const eventLabels = {
  webhook_push:   'Webhook Push',
  manual_update:  'Manual Update',
  initial_import: 'Initial Import',
};

function ActivityRow({ event }) {
  const [open, setOpen] = useState(false);
  
  const isSuccess = event.status === 'successful';
  const isRunning = event.status === 'running';
  
  const statusColor = isSuccess ? '#059669' : isRunning ? '#d97706' : '#dc2626';
  const statusBg = isSuccess ? '#ecfdf5' : isRunning ? '#fffbeb' : '#fef2f2';

  return (
    <div style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px 32px', padding: '16px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#f1f5f9" }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 4px 0' }}>
              {eventLabels[event.event_type] || 'Manual Update'}
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {format(new Date(event.created_at), 'MMM d, h:mm a')}
            </p>
          </div>
        </div>
        
        <div>
          <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {isSuccess && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            {isRunning && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>}
            {!isSuccess && !isRunning && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
            {event.status ? event.status.charAt(0).toUpperCase() + event.status.slice(1) : 'Unknown'}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {event.files_count || 0} files
        </div>

        <div style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'flex-end' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px', backgroundColor: '#f8fafc', fontSize: '13px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)' }}>
          <div style={{ display: 'flex' }}><strong style={{ width: '120px' }}>Triggered by:</strong> <span>{event.triggered_by || 'system'}</span></div>
          <div style={{ display: 'flex' }}><strong style={{ width: '120px' }}>Event ID:</strong> <span style={{ fontFamily: 'monospace' }}>{event.id}</span></div>
        </div>
      )}
    </div>
  );
}

export default function ProjectOverview() {
  const { id } = useParams(); 
  const [project, setProject] = useState(null);
  const [events, setEvents] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const name = user?.user_metadata?.full_name || user?.user_metadata?.user_name || user?.email?.split('@')[0];
      setUserName(name);

      const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).single();
      setProject(projectData);

      const { data: eventsData } = await supabase.from('build_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(20);
      setEvents(eventsData || []);
      setLoading(false);
    };
    
    fetchData();

    // --- NEW SAAS-TIER FEATURE: Realtime UI Updates ---
    // Listen for any updates to THIS specific project in the database
    const subscription = supabase
      .channel('project-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
          filter: `id=eq.${id}` // Only listen for this exact project
        },
        (payload) => {
          console.log("⚡ Realtime Update Received!", payload.new);
          // Instantly update the UI with the new database row!
          setProject(payload.new);
        }
      )
      .subscribe();

    // Cleanup the listener when you leave the page
    return () => {
      supabase.removeChannel(subscription);
    };
  }, [id]);

  const handleRegenerate = async () => {
    await updateProjectStatus(project.id, 'building', 0);
    setProject(p => ({ ...p, status: 'building' }));
    
    const optimisticEvent = {
      id: 'temp-' + Date.now(),
      project_id: project.id,
      event_type: 'manual_update',
      status: 'running',
      files_count: 0,
      triggered_by: 'dashboard',
      created_at: new Date().toISOString()
    };
    setEvents(prev => [optimisticEvent, ...prev]);
    
    fetch('http://localhost:4000/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoUrl: project.repo_url,
        projectName: project.project_name,
        tenantName: project.tenant_name
      })
    }).catch(err => console.error("Trigger failed", err));
  };

  if (loading || !project) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)" }}>
        <Navbar />
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>{loading ? "Loading project details..." : "Project not found."}</div>
      </div>
    );
  }

  const status = statusColors[project.status] || statusColors.pending;
  const deployUrl = `https://${project.project_name}.docgen.app`; 

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-sidebar)", fontFamily: "system-ui, -apple-system, sans-serif", paddingBottom: "60px" }}>
      <Navbar />
      
      {/* ---------- THIS IS THE NEW WRAPPER FOR SIDEBAR + CONTENT ---------- */}
      <div style={{ display: "flex", width: "100%" }}>
        
        {/* The Sidebar is now physically placed on the left! */}
        <DashboardSidebar />
        
        {/* Main Content Area gets flex: 1 to fill the remaining right side */}
        <div style={{ flex: 1, maxWidth: "1200px", margin: "0 auto", padding: "40px 32px" }}>
          
          <div style={{ marginBottom: "40px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 8px 0" }}>
              {getGreeting(userName)}
            </h1>
            <p style={{ fontSize: "15px", color: "var(--text-muted)", margin: 0 }}>
              Welcome back to your docs dashboard
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "32px", marginBottom: "40px" }}>
            
            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', minHeight: '400px', backgroundColor: "var(--bg-main)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              {project.status === 'successful' ? (
                <iframe
  src={`http://localhost:5173/docs/${project.tenant_name}/${project.project_name}`}
  style={{ width: '100%', height: '100%', minHeight: '400px', border: 'none' }}
  title='Docs preview'
/>
              ) : (
                <PreviewUnavailable status={project.status} />
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", margin: 0 }}>{project.project_name}</h2>
                <span style={{ backgroundColor: status.bg, color: status.color, padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: "600" }}>
                  {status.label}
                </span>
              </div>
              
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Last updated {formatDistanceToNow(new Date(project.updated_at))} ago
              </p>

              <ActionButtons project={project} onRebuild={handleRegenerate} />

              <div style={{ height: "1px", backgroundColor: "var(--border-color)", margin: "24px 0" }}></div>

              <div style={{ marginBottom: "24px" }}>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px", fontWeight: "500" }}>Domain</p>
                <a href={deployUrl} target="_blank" rel="noreferrer" style={{ fontSize: "14px", color: "var(--text-heading)", fontWeight: "500", textDecoration: "none", display: "block", marginBottom: "8px" }}>
                  {deployUrl} ↗
                </a>
                <button style={{ fontSize: "13px", color: "var(--primary-brand)", background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: "500" }}>
                  + Add custom domain
                </button>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                  <span style={{ fontSize: "14px", color: "var(--text-heading)", fontWeight: "500" }}>{project.tenant_name} / {project.project_name}</span>
                </div>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 0 20px" }}>
                  branch <strong style={{ color: "var(--text-heading)" }}>main</strong>
                </p>
              </div>

            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "16px" }}>
              <div>
                <h2 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-heading)", margin: "0 0 4px 0" }}>Activity</h2>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>Recent changes made to your docs</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ padding: "6px 12px", backgroundColor: "white", border: "1px solid var(--border-color)", borderRadius: "6px", fontSize: "13px", fontWeight: "500", color: "var(--text-heading)", cursor: "pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  Live
                </button>
                <button style={{ padding: "6px 12px", backgroundColor: "transparent", border: "1px solid transparent", borderRadius: "6px", fontSize: "13px", fontWeight: "500", color: "var(--text-muted)", cursor: "pointer" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}><circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path></svg>
                  Previews
                </button>
              </div>
            </div>
            
            <div style={{ backgroundColor: "var(--bg-main)", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 32px", padding: "12px 16px", backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border-color)", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <span>Activity</span>
                <span>Status</span>
                <span>Changes</span>
                <span></span>
              </div>

              {events.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px" }}>No activity recorded yet. Rebuild the project to generate events.</div>
              ) : (
                <div>
                  {events.map((event) => (
                    <ActivityRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}