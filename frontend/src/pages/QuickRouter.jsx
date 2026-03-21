import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/auth";

export default function QuickRouter() {
  const { tenant, version } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function routeUser() {
      const { data, error } = await supabase
        .from('projects')
        .select('id')
        .eq('tenant_name', tenant)
        .eq('project_name', version)
        .single();

      if (data && !error) {
        navigate(`/docs/${tenant}/${version}`, { replace: true });
      } else {
        const githubUrl = `https://github.com/${tenant}/${version}`;
        navigate(`/dashboard/new?repo=${encodeURIComponent(githubUrl)}`, { replace: true });
      }
    }
    
    routeUser();
  }, [tenant, version, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-main)", color: "var(--text-heading)", fontFamily: "system-ui" }}>
      <div style={{ width: "40px", height: "40px", border: "3px solid #f3f3f3", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <h2 style={{ fontSize: "18px", fontWeight: "600" }}>Routing to {tenant}/{version}...</h2>
    </div>
  );
}