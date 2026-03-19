import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          
          {/* PUBLIC ROUTE */}
          <Route path="/" element={<LandingPage />} />

          {/* AUTH ROUTE */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />

          {/* PROTECTED ROUTES */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/dashboard/new" 
            element={
              <ProtectedRoute>
                <NewProject />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/dashboard/:id" 
            element={
              <ProtectedRoute>
                <ProjectOverview />
              </ProtectedRoute>
            } 
          />

          {/* Project Settings Page */}
          <Route 
            path="/dashboard/:id/settings" 
            element={
              <ProtectedRoute>
                <ProjectSettings />
              </ProtectedRoute>
            } 
          />
          
          {/* --- UPDATED ROUTE --- */}
          {/* Added :tenant and :version so the router knows how to handle the dynamic iframe URL */}
          <Route 
            path="/docs/:tenant/:version" 
            element={
              <ProtectedRoute>
                <DocEngine />
              </ProtectedRoute>
            } 
          />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;