import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { supabase, handleFirstLogin } from "./lib/auth"; 
import NewProject from "./pages/NewProject";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DocEngine from "./pages/DocEngine";
import Dashboard from "./pages/Dashboard"; 
import ProtectedRoute from "./components/ProtectedRoute";
import ProjectOverview from "./pages/ProjectOverview";
import ProjectSettings from "./pages/ProjectSettings";

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />; 
  return children;
}

// --- NEW: Global Auth Listener Component ---
function AuthListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          navigate('/login', { replace: true });
        }
        if (event === 'TOKEN_REFRESHED') {
          console.log('Session refreshed');
        }
        if (event === 'SIGNED_IN' && session?.user) {
          handleFirstLogin(session.user);
        }
      }
    );
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  return null; 
}

function App() {
  const [isLoadingDomain, setIsLoadingDomain] = useState(true);
  const [customDomainData, setCustomDomainData] = useState(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    
    const isMainApp = 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' || 
      hostname.includes('prismify.yashwant.xyz') || 
      hostname.includes('docgen.app');

    if (isMainApp) {
      setIsLoadingDomain(false);
      return;
    }

    const fetchDomain = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const res = await fetch(`${API_URL}/api/domain/${hostname}`);
        if (res.ok) {
          const data = await res.json();
          setCustomDomainData(data); 
        }
      } catch (err) {
        console.error("Failed to check domain", err);
      }
      setIsLoadingDomain(false);
    };

    fetchDomain();
  }, []);

  if (isLoadingDomain) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0f172a", color: "white", fontFamily: "system-ui, sans-serif" }}>
        <h2>Loading Prismify...</h2>
      </div>
    );
  }

  if (customDomainData) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={
            <DocEngine 
              customTenant={customDomainData.tenant} 
              customVersion={customDomainData.version} 
            />
          } />
        </Routes>
      </Router>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <AuthListener />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/new" element={<ProtectedRoute><NewProject /></ProtectedRoute>} />
          <Route path="/dashboard/:id" element={<ProtectedRoute><ProjectOverview /></ProtectedRoute>} />
          <Route path="/dashboard/:id/settings" element={<ProtectedRoute><ProjectSettings /></ProtectedRoute>} />
          <Route path="/docs/:tenant/:version" element={<ProtectedRoute><DocEngine /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;