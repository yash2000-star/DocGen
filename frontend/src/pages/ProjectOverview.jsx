import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { supabase } from "../lib/auth";
import { updateProjectStatus } from "../lib/projects";
import { getGreeting } from "../lib/utils";
import { getUserRole } from '../lib/projects';
import { apiFetch } from '../lib/api';

const statusColors = {
  live:       { bg: '#ecfdf5', color: '#059669', label: 'Live' },
  successful: { bg: '#ecfdf5', color: '#059669', label: 'Live' },
  running:    { bg: '#fffbeb', color: '#d97706', label: 'Building' },
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
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.6 }} xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="25%" height="100%" fill="#f1f5f9" />
        <rect x="20" y="30" width="15%" height="12" rx="4" fill="#e2e8f0" />
        <rect x="20" y="60" width="18%" height="8" rx="4" fill="#e2e8f0" />
        <rect x="20" y="80" width="12%" height="8" rx="4" fill="#e2e8f0" />
        <rect x="30%" y="30" width="40%" height="20" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="80" width="60%" height="10" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="110" width="55%" height="10" rx="4" fill="#f1f5f9" />
        <rect x="30%" y="140" width="45%" height="10" rx="4" fill="#f1f5f9" />
      </svg>
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

function ActionButtons({ project, onRebuild, userRole }) {
  const [copied, setCopied] = useState(false);
  const deployUrl = project.custom_domain ? `https://${project.custom_domain}` : `https://${project.project_name}.docgen.app`; 

  const handleCopy = () => {
    navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const btnStyle = { 
    padding: "6px 12px", 
    backgroundColor: "#ffffff", 
    border: "1px solid #e2e8f0", 
    borderRadius: "8px", 
    cursor: "pointer", 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: "6px",
    color: "#475569", 
    fontSize: "13px",
    fontWeight: "500",
    transition: "all 0.2s",
    boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
  };

  const iconOnlyStyle = { ...btnStyle, padding: "8px" };

  return (
    <div style={{ display: 'flex', gap: '8px', margin: '16px 0 0 0' }}>
      <button onClick={handleCopy} style={iconOnlyStyle} title="Copy URL">
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        )}
      </button>
      
      {['admin', 'editor'].includes(userRole) && (
        <button onClick={onRebuild} disabled={project.status === 'building'} style={{...iconOnlyStyle, opacity: project.status === 'building' ? 0.5 : 1}} title="Manual Update">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: project.status === 'building' ? 'spin 1s linear infinite' : 'none' }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
        </button>
      )}
      
      {/* Mintlify Visit Site Button */}
      <button onClick={() => window.open(deployUrl, '_blank')} style={btnStyle} title="Visit site">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
        Visit site
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
  const isSuccess = event.status === 'successful' || event.status === 'live';
  const isRunning = event.status === 'running' || event.status === 'building';
  
  const statusColor = isSuccess ? '#059669' : isRunning ? '#d97706' : '#dc2626';
  const statusBg = isSuccess ? '#ecfdf5' : isRunning ? '#fffbeb' : '#fef2f2';

  return (
    <div style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: open ? '#f8fafc' : '#ffffff' }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 32px', padding: '16px 24px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = open ? '#f8fafc' : 'transparent'}
      >
        {/* Column 1: Activity Name & Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#f1f5f9", flexShrink: 0 }}>
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: '0 0 2px 0' }}>
              {eventLabels[event.event_type] || 'Manual Update'}
            </p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              {formatDistanceToNow(new Date(event.created_at))} ago
            </p>
          </div>
        </div>
        
        {/* Column 2: Status Rounded Rectangle */}
        <div>
          <span style={{ backgroundColor: statusBg, color: statusColor, padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {isSuccess && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            {isRunning && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>}
            {!isSuccess && !isRunning && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>}
            {isSuccess ? 'Successful' : event.status ? event.status.charAt(0).toUpperCase() + event.status.slice(1) : 'Unknown'}
          </span>
        </div>

        {/* Column 3: Changes (Empty by default in Mintlify unless specified) */}
        <div style={{ fontSize: '13px', color: '#64748b' }}>
          {event.files_count > 0 ? `${event.files_count} files` : '-'}
        </div>

        {/* Column 4: Chevron */}
        <div style={{ color: '#94a3b8', display: 'flex', justifyContent: 'flex-end' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px 24px 16px 76px', fontSize: '13px', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex' }}><strong style={{ width: '100px', color: '#334155' }}>Triggered by:</strong> <span>{event.triggered_by || 'system'}</span></div>
          <div style={{ display: 'flex' }}><strong style={{ width: '100px', color: '#334155' }}>Event ID:</strong> <span style={{ fontFamily: 'monospace' }}>{event.id}</span></div>
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
  const [userRole, setUserRole] = useState("viewer");
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const name = user?.user_metadata?.full_name || user?.user_metadata?.user_name || user?.email?.split('@')[0];
      setUserName(name);

      const { data: projectData } = await supabase.from('projects').select('*').eq('id', id).single();
      setProject(projectData);

      const role = await getUserRole(id);
      setUserRole(role);

      const { data: eventsData } = await supabase.from('build_events').select('*').eq('project_id', id).order('created_at', { ascending: false }).limit(20);
      setEvents(eventsData || []);
      
      setLoading(false);
    };
    
    fetchData();

    const subscription = supabase
      .channel('project-status-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${id}` },
        (payload) => {
          setProject(payload.new);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(subscription);
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

    apiFetch(`/api/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: project.repo_url, projectName: project.project_name, tenantName: project.tenant_name })
    }).catch(err => console.error("Trigger failed", err));
  };

  if (loading || !project) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {loading ? "Loading project details..." : "Project not found."}
      </div>
    );
  }

  const status = statusColors[project.status] || statusColors.pending;
  const displayUrl = project.custom_domain ? `https://${project.custom_domain}` : `https://${project.project_name}.docgen.app`;

  let displayUserName = userName;
  if (userName === 'yash2000-star') {
    const stripped = userName.split(/[-0-9]/)[0];
    displayUserName = stripped.charAt(0).toUpperCase() + stripped.slice(1);
  }

  return (
    <div style={{ paddingBottom: "60px", fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 40px" }}>
        
       {/* --- 1. MINTLIFY TOP HEADER --- */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "600", color: "#0f172a", margin: "0 0 6px 0", letterSpacing: "-0.3px" }}>
              {getGreeting(displayUserName)}
            </h1>
            <p style={{ fontSize: "14px", color: "#64748b", margin: 0 }}>
              Welcome back to your docs dashboard
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "32px", marginBottom: "40px" }}>
          
          <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => window.open(displayUrl, '_blank')}
            style={{ 
              border: '1px solid #e2e8f0', 
              borderRadius: '12px', 
              height: '320px', 
              backgroundColor: "#f8fafc", 
              boxShadow: isHovered ? "0 10px 15px -3px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.05)", 
              position: 'relative', 
              padding: '16px',
              transition: 'all 0.2s ease',
              transform: isHovered ? 'scale(1.02)' : 'scale(1)',
              cursor: isHovered ? 'pointer' : 'default'
            }}
          >
            {project.status === 'successful' || project.status === 'live' ? (
              <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative", borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <iframe
                  src={`http://localhost:5173/docs/${project.tenant_name}/${project.project_name}`}
                  scrolling="no" /* <-- THIS IS THE MAGIC BULLET to kill the scrollbar */
                  style={{ 
                    width: '200%', 
                    height: '200%', 
                    border: 'none',
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: '#ffffff'
                  }}
                  title='Docs preview'
                />
              </div>
            ) : (
              <PreviewUnavailable status={project.status} />
            )}
          </div>

          <div>
            {/* --- 2. MINTLIFY PROJECT TITLE & BADGE --- */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>
                {project.project_name === "Mint Starter Kit" ? "Mint Starter Kit" : project.project_name}
              </h2>
              <span style={{ backgroundColor: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: "99px", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "6px", height: "6px", backgroundColor: "#10b981", borderRadius: "50%" }}></div>
                Live
              </span>
            </div>
            
            <div style={{ fontSize: "13px", color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
              Last updated {formatDistanceToNow(new Date(project.updated_at))} ago by 
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#0f172a", fontWeight: "500" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.36l5.67-5.67"/></svg>
                Manual Update
              </span>
            </div>

            <ActionButtons project={project} onRebuild={handleRegenerate} userRole={userRole} />

            {/* --- 3. MINTLIFY DOMAIN SECTION --- */}
            <div style={{ marginBottom: "32px", marginTop: "36px" }}>
              <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>Domain</p>
              
              <a href={displayUrl} target="_blank" rel="noreferrer" style={{ fontSize: "14px", color: "#0f172a", fontWeight: "500", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                {displayUrl}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
              </a>

              {userRole === 'admin' && (
                <div>
                  <Link to={`/dashboard/${project.id}/settings`} style={{ fontSize: "14px", color: "#059669", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "500", marginTop: "-4px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: "2 2" }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    Add custom domain
                  </Link>
                </div>
              )}
            </div>

            {/* --- 4. MINTLIFY GITHUB & BRANCH SECTION --- */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                <a href={`https://github.com/${project.tenant_name}/${project.project_name}`} target="_blank" rel="noreferrer" style={{ fontSize: "14px", color: "#0f172a", fontWeight: "600", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                  {project.tenant_name} / {project.project_name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7"/></svg>
                </a>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"></path><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path></svg>
                <span style={{ fontSize: "14px", color: "#64748b" }}>
                  branch <strong style={{ color: "#0f172a", fontWeight: "600" }}>main</strong>
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* --- 5. MINTLIFY ACTIVITY TABLE --- */}
        <div style={{ marginTop: "48px" }}>
          <div style={{ marginBottom: "24px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "600", color: "#0f172a", margin: "0 0 6px 0", letterSpacing: "-0.5px" }}>Activity</h2>
            <p style={{ fontSize: "15px", color: "#64748b", margin: 0 }}>Recent changes made to your docs</p>
          </div>
          
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 32px", padding: "16px 24px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
              <span>Activity</span>
              <span>Status</span>
              <span>Changes</span>
              <span></span>
            </div>

            {events.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#64748b", fontSize: "14px" }}>No activity recorded yet. Rebuild the project to generate events.</div>
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
  );
}