import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();

  // If there is no user logged in, gracefully route them to the landing page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // If they are logged in, let them see the dashboard
  return children;
}