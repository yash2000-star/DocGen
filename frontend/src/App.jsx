import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import NewProject from "./pages/NewProject";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DocEngine from "./pages/DocEngine";
import Dashboard from "./pages/Dashboard"; // <-- Imported Dashboard
import ProtectedRoute from "./components/ProtectedRoute";
import ProjectOverview from "./pages/ProjectOverview";

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />; // <-- Redirects to dashboard now, not docs
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
          
          {/* We will leave this here for now so your MDX engine still works! */}
          <Route 
            path="/docs" 
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